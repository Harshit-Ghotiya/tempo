// Tempo launcher: serves the embedded portal on this machine only and opens it in the default browser.
// Everything the page needs (UI, MediaPipe code and WASM) is inside this file. The two small model files are
// downloaded once from Google's official MediaPipe host into a cache folder, then served locally.
package main

import (
	"bufio"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

//go:embed all:site
var assets embed.FS

const minModel = 1 << 20 // anything smaller than 1 MB is a failed download

var models = map[string]string{
	"face_landmarker.task":      "face_landmarker/face_landmarker/float16/1/face_landmarker.task",
	"pose_landmarker_lite.task": "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
}

var (
	logger   *log.Logger
	dl       sync.Mutex
	lastBeat atomic.Int64
)

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil && v > 0 {
		return v
	}
	return d
}

func dataDir() string { // downloaded models and the log live here
	if d := os.Getenv("TEMPO_CACHE_DIR"); d != "" {
		return d
	}
	if d, err := os.UserCacheDir(); err == nil {
		return filepath.Join(d, "Tempo")
	}
	return filepath.Join(os.TempDir(), "Tempo")
}

func initLog() {
	_ = os.MkdirAll(dataDir(), 0o755)
	w := io.Writer(os.Stdout)
	if f, err := os.OpenFile(filepath.Join(dataDir(), "tempo.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		w = io.MultiWriter(os.Stdout, f)
	}
	logger = log.New(w, "", log.LstdFlags)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func fail(msg string) {
	logger.Println(msg)
	fmt.Println("Press Enter to close.")
	bufio.NewReader(os.Stdin).ReadString('\n')
	os.Exit(1)
}

func cached(p string) bool { st, err := os.Stat(p); return err == nil && st.Size() > minModel }

// modelPath finds a model: next to the app (offline use), in the cache, or by downloading it once.
func modelPath(name string) (string, error) {
	rel, ok := models[name]
	if !ok {
		return "", fmt.Errorf("unknown model %q", name)
	}
	if exe, err := os.Executable(); err == nil {
		if p := filepath.Join(filepath.Dir(exe), "models", name); cached(p) {
			return p, nil
		}
	}
	p := filepath.Join(dataDir(), "models", name)
	if cached(p) {
		return p, nil
	}
	dl.Lock()
	defer dl.Unlock()
	if cached(p) { // another request finished it while we waited
		return p, nil
	}
	url := os.Getenv("TEMPO_MODEL_BASE")
	if url == "" {
		url = "https://storage.googleapis.com/mediapipe-models/"
	}
	url += rel
	logger.Printf("Downloading %s (first run only)...", name)
	resp, err := (&http.Client{Timeout: 3 * time.Minute}).Get(url)
	if err != nil {
		return "", fmt.Errorf("could not download: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with HTTP %d", resp.StatusCode)
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return "", err
	}
	tmp := p + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return "", err
	}
	n, err := io.Copy(f, resp.Body)
	f.Close()
	if err != nil || n <= minModel {
		os.Remove(tmp)
		return "", fmt.Errorf("download incomplete")
	}
	if err := os.Rename(tmp, p); err != nil {
		return "", err
	}
	logger.Printf("Saved %s (%.1f MB)", name, float64(n)/1e6)
	return p, nil
}

func serveModel(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/models/")
	p, err := modelPath(name)
	if err != nil {
		logger.Printf("model %s unavailable: %v", name, err)
		http.Error(w, "Model unavailable ("+err.Error()+"). Connect to the internet once so it can download, "+
			"or put the file in a folder named models next to the app.", http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, p)
}

// existing reports whether a Tempo is already serving on this port.
func existing(port int) bool {
	resp, err := (&http.Client{Timeout: 400 * time.Millisecond}).Get("http://127.0.0.1:" + strconv.Itoa(port) + "/__tempo")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 16))
	return strings.TrimSpace(string(b)) == "tempo"
}

func main() {
	port := flag.Int("port", 8000, "preferred port; the next free one is used if it is busy")
	noBrowser := flag.Bool("nobrowser", false, "do not open the browser")
	flag.Parse()
	initLog()

	// Set the types explicitly: some Windows setups map .js to text/plain, which breaks ES modules.
	for ext, typ := range map[string]string{".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
		".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".wasm": "application/wasm"} {
		_ = mime.AddExtensionType(ext, typ)
	}
	site, err := fs.Sub(assets, "site")
	if err != nil {
		fail(err.Error())
	}

	// Already running? Open that one instead of starting a second copy.
	for p := *port; p < *port+10; p++ {
		if existing(p) {
			u := "http://localhost:" + strconv.Itoa(p) + "/"
			logger.Println("Tempo is already running at", u, "- opening it.")
			if !*noBrowser {
				openBrowser(u)
			}
			return
		}
	}

	// Loopback only: the portal is never exposed to the network.
	var ln net.Listener
	p := *port
	for ; p < *port+10; p++ {
		if ln, err = net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p)); err == nil {
			break
		}
	}
	if err != nil {
		fail("Could not find a free port: " + err.Error())
	}

	files := http.FileServer(http.FS(site))
	mux := http.NewServeMux()
	mux.HandleFunc("/__tempo", func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "tempo") })
	mux.HandleFunc("/__alive", func(w http.ResponseWriter, r *http.Request) {
		lastBeat.Store(time.Now().UnixNano())
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/models/", serveModel)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		files.ServeHTTP(w, r)
	})
	srv := &http.Server{Handler: mux}
	go srv.Serve(ln)
	if ln6, err := net.Listen("tcp", "[::1]:"+strconv.Itoa(p)); err == nil {
		go srv.Serve(ln6)
	}

	// The page pings /__alive while it is open. With no ping for a while, there is nobody left: quit.
	idle := time.Duration(envInt("TEMPO_IDLE_SECONDS", 180)) * time.Second
	lastBeat.Store(time.Now().UnixNano())
	go func() {
		for range time.Tick(2 * time.Second) {
			if time.Since(time.Unix(0, lastBeat.Load())) > idle {
				logger.Printf("No browser connected for %v. Quitting.", idle)
				os.Exit(0)
			}
		}
	}()

	url := "http://localhost:" + strconv.Itoa(p) + "/"
	if p != *port {
		logger.Printf("Port %d is busy, using %d instead.", *port, p)
	}
	logger.Println("Tempo is running at", url)
	logger.Println("Video is processed in your browser only. Close the browser tab and Tempo quits by itself.")
	if !*noBrowser {
		openBrowser(url)
	}
	select {}
}

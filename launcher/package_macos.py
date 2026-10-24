#!/usr/bin/env python3
"""
Builds dist/Tempo-macOS/Tempo.app: one universal app (Intel and Apple silicon), ad-hoc signed.

  python3 package_macos.py            (run build.sh first; set RCODESIGN or put rcodesign on PATH to sign)

Why: a bare Mach-O file loses its executable bit when downloaded, and Apple silicon refuses unsigned code.
A zipped, ad-hoc-signed .app avoids both. It is NOT notarised (that needs a paid Apple developer account),
so macOS still asks for a one-time approval: see the README written next to the app.
"""
import os, pathlib, plistlib, shutil, struct, subprocess, sys

here = pathlib.Path(__file__).parent
dist = here / "dist"
out = dist / "Tempo-macOS"
amd, arm = (dist / "tempo-darwin-amd64").read_bytes(), (dist / "tempo-darwin-arm64").read_bytes()
for name, b in (("amd64", amd), ("arm64", arm)):
    assert b[:4] == b"\xcf\xfa\xed\xfe", f"{name} is not a 64-bit Mach-O file"

# Universal ("fat") Mach-O: header, one entry per architecture, slices aligned to 16 KB.
ALIGN = 14
slices = [(0x01000007, 3, amd), (0x0100000C, 0, arm)]  # x86_64, arm64
offset = 1 << ALIGN
entries, body = b"", b""
for cpu, sub, data in slices:
    pad = (-len(body)) % (1 << ALIGN)
    body += b"\0" * pad
    entries += struct.pack(">5I", cpu, sub, offset + len(body), len(data), ALIGN)
    body += data
header = struct.pack(">2I", 0xCAFEBABE, len(slices)) + entries
fat = header + b"\0" * (offset - len(header)) + body

shutil.rmtree(out, ignore_errors=True)
app = out / "Tempo.app" / "Contents"
(app / "MacOS").mkdir(parents=True)
(app / "MacOS" / "Tempo").write_bytes(fat)
os.chmod(app / "MacOS" / "Tempo", 0o755)
(app / "Info.plist").write_bytes(plistlib.dumps({
    "CFBundleName": "Tempo", "CFBundleDisplayName": "Tempo", "CFBundleIdentifier": "org.tempo.stress-signals",
    "CFBundleExecutable": "Tempo", "CFBundlePackageType": "APPL", "CFBundleInfoDictionaryVersion": "6.0",
    "CFBundleVersion": "0.6", "CFBundleShortVersionString": "0.6", "LSMinimumSystemVersion": "11.0",
    "LSBackgroundOnly": True,  # no window or Dock icon of its own; the portal opens in your browser
    "NSHighResolutionCapable": True}))
(app / "PkgInfo").write_bytes(b"APPL????")

rc = os.environ.get("RCODESIGN") or shutil.which("rcodesign")
if rc:
    subprocess.run([rc, "sign", str(out / "Tempo.app")], check=True)
    print("ad-hoc signed with rcodesign")
else:
    print("WARNING: rcodesign not found, the app is unsigned (Apple silicon may report it as damaged)")
print("built", out / "Tempo.app")

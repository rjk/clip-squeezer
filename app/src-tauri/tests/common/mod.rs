use std::path::PathBuf;

pub fn find_test_binary(name: &str) -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let ext = if cfg!(windows) { ".exe" } else { "" };
    let plain = format!("{}{}", name, ext);
    let target_triple = env!("TARGET_TRIPLE");
    let sidecar = format!("{}-{}{}", name, target_triple, ext);

    let candidates = [
        manifest_dir.join("binaries").join(&sidecar),
        manifest_dir.join("binaries").join(&plain),
        manifest_dir.join("binaries").join(format!("{}-x86_64-pc-windows-msvc.exe", name)),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    #[cfg(windows)]
    {
        let choco = PathBuf::from("C:\\ProgramData\\chocolatey\\lib\\ffmpeg\\tools\\ffmpeg\\bin").join(&plain);
        if choco.exists() {
            return choco;
        }
    }

    #[cfg(not(windows))]
    {
        for prefix in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
            let p = PathBuf::from(prefix).join(&plain);
            if p.exists() {
                return p;
            }
        }
    }

    manifest_dir.join("binaries").join(&sidecar)
}

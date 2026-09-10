fn main() {
    println!("cargo:rustc-env=TARGET_TRIPLE={}", std::env::var("TARGET").unwrap());
    tauri_build::build()
}


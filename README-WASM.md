# Building the Optional Rust Speedup (WASM) for JivanOS

JivanOS works **100% out of the box** without compiling Rust — every quote feature has a built-in TypeScript version that produces the exact same results.

If you want the extra Rust WebAssembly speedup for very large CSV imports and quote-library hashing, GitHub can compile the Rust code for you **for free** in about 1–2 minutes.

---

## Step 1: Push your project to GitHub

Make sure your latest JivanOS code (including the `rust-quotes/` folder and `.github/workflows/build-wasm.yml`) is pushed to your GitHub repository.

## Step 2: Run the automatic build on GitHub

Whenever you push a change inside `rust-quotes/`, GitHub starts building automatically. You can also trigger it manually at any time:

1. Open your repository on **github.com**.
2. Click the **Actions** tab at the top.
3. On the left side, click **Build Quotes Rust WASM**.
4. Click the **Run workflow** button on the right, then click the green **Run workflow** button.
5. Wait ~1–2 minutes until you see a green checkmark next to the run.

## Step 3: Get the compiled files into the app

- **Automatic commit (easiest):** If your repo allows GitHub Actions to write commits (Settings → Actions → General → Workflow permissions → **Read and write permissions**), GitHub automatically commits the compiled files into `src/wasm/` for you. Just pull/sync your repo.
- **Manual download (if auto-commit is off):**
  1. Click the completed green run in **Actions**.
  2. Scroll down to **Artifacts** and click **quotes-wasm-bundle** to download a `.zip` file.
  3. Unzip it — you will see `quotes_wasm.js`, `quotes_wasm_bg.wasm` (and `.d.ts` files).
  4. Copy those files into the `src/wasm/` folder in your JivanOS project.

## Step 4: Rebuild the app

Run `npm run build` (or let your normal web/Android build run). Vite automatically bundles `src/wasm/quotes_wasm_bg.wasm` into `dist/`, so it is included on web, desktop, and Capacitor Android.

If `src/wasm/` is ever empty or deleted, JivanOS automatically and silently uses the built-in TypeScript fallback with zero errors.

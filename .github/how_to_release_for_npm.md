# npm リリース手順

## 前提

- Node.js は `.node-version` に合わせて `24.22.1` を使う。

- パッケージマネージャは `npm`（`devEngines.packageManager.name=npm`、`engines.npm` で `>=12.2.1`）。
- `.npmrc` で `min-release-age=7` を設定しているため、npm のバージョンが 12.2.1であること。
  ```sh
  npm --version  # 12.2.1であること
  ```
  異なれば `npm install -g npm@12.2.1` でアップグレードする。

## 手順

### 1. バージョンを上げる

`package.json` の `version` を編集し、git tag を打つ。

```bash
git tag 0.x.x
git push origin 0.x.x   # GitHub Release が CI (release.yml) で自動生成される
```

### 2. npm にログイン（未ログインの場合）

```bash
npm login --registry https://registry.npmjs.org
# ブラウザが開くので認証する

# 確認
npm whoami --registry https://registry.npmjs.org
```

> Note: pnpm 時代は `cd ~` してから `pnpm login` を実行する回避策が必要だったが、npm では不要。

### 3. ビルド & publish

```bash
npm ci
npm run build
npm publish --access public
```

# npm リリース手順

## 前提

- パッケージマネージャは `npm`（`devEngines.packageManager.name=npm`、`engines.npm` で `>=11.10.0`）。
- `.npmrc` で `min-release-age=1` を設定しているため、npm のバージョンが 11.10.0 以上であること。
  ```sh
  npm --version  # 11.10.0 以上であること
  ```
  古ければ `npm install -g npm@latest` でアップグレードする。

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

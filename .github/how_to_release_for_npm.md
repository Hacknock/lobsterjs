# npm リリース手順

## 前提

- `npm` コマンドは禁止。`pnpm` を使う。
- `pnpm login` は **lobsterjs ディレクトリの外** で実行すること。
  （lobsterjs 内で実行すると `devEngines` チェックに引っかかってエラーになる）

## 手順

### 1. バージョンを上げる

`package.json` の `version` を手動で編集し、git tag を打つ。

```bash
git tag 0.x.x
git push origin 0.x.x   # GitHub Release が CI で自動生成される
```

### 2. npm にログイン（未ログインの場合）

```bash
cd ~
pnpm login --registry https://registry.npmjs.org
# ブラウザが開くので認証する

# 確認
pnpm whoami --registry https://registry.npmjs.org
```

### 3. ビルド & publish

```bash
cd /path/to/lobsterjs
pnpm run build
pnpm publish --access public
```

## 注意

- `pnpm login` を lobsterjs ディレクトリ内で実行すると以下のエラーが出る（npm が呼ばれてしまう）:
  ```
  npm error EBADDEVENGINES Invalid name "pnpm" does not match "npm"
  ```
  必ず `cd ~` などでディレクトリを移動してから実行すること。

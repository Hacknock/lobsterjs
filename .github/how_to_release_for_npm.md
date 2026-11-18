# npm リリース手順

npm への公開は、GitHub Actions（`release.yml`）から npm の Trusted Publishing（OIDC）で行う。
CI はパッケージをステージ（仮公開）するだけで、一般公開にはメンテナーによる 2FA での承認が必要である。
npm のアクセストークンは使わない。

## 前提

- Node.js は `.node-version` に合わせて `24.22.3` を使う。
- パッケージマネージャは `npm`（`devEngines.packageManager.name=npm`、`engines.npm` で `>=12.2.1`）。
- `.npmrc` で `min-release-age=7` を設定しているため、npm のバージョンが 12.2.1 であること。
  ```sh
  npm --version  # 12.2.1であること
  ```
  異なれば `npm install -g npm@12.2.1` でアップグレードする。
- npmjs.com の `@hacknock/lobster` の Trusted Publisher に、`Hacknock/lobsterjs` の `release.yml` が登録されていること。
  Allowed actions は `npm stage publish` のみ（`Allow npm publish` と `Allow npm dist-tag` は無効）とする。

## 手順

### 1. バージョンを上げる

`package.json` と `package-lock.json` の `version` を上げる PR を作り、main にマージする。

```bash
npm version 0.x.x --no-git-tag-version
```

### 2. タグを push する

main の最新コミットにタグを打って push する。

```bash
git switch main
git pull --ff-only
git tag 0.x.x
git push origin 0.x.x
```

`release.yml` の `publish` ジョブが次の処理を行う。

1. タグが `x.y.z` 形式の正式版で、`package.json` の `version` と一致するか確認する。
   `0.6.0-beta.1` のようなプレリリース版のタグや、一致しないタグでは失敗する。
2. テストとビルドを実行する。
3. `lobster.js` と `lobster-skills.zip` をアーティファクトとして保存する。
4. `npm stage publish` でパッケージをステージする。

`publish` ジョブが成功すると、`release` ジョブが GitHub Release を作成し、保存した `lobster.js` と `lobster-skills.zip` を添付する。
`release` ジョブだけが失敗した場合は、失敗したジョブだけを再実行する。
ワークフロー全体を再実行すると、同じバージョンをもう一度ステージしようとして失敗する。

### 3. ステージされたパッケージを承認する

npm にログインした状態で、ステージされたパッケージを確認して承認する。
承認時に 2FA を求められる。

```bash
npm login --registry https://registry.npmjs.org
npm stage list @hacknock/lobster
npm stage view <stage-id>
npm stage approve <stage-id>
```

npmjs.com から承認することもできる。
内容に問題がある場合は `npm stage reject <stage-id>` で取り下げる。

### 4. 公開を確認する

```bash
npm view @hacknock/lobster version
```

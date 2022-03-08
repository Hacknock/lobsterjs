# 見出し
## 見出し２
### 見出し３
#### 見出し４
##### 見出し５

行末にスペースを２つ書いて改行
改行された後の文章

*これは強調（斜体）*
_これは強調（斜体）_

*これは強調（斜体）*_これは強調（斜体）_*これは強調（斜体）*

**これは強調（太字）**
__これは強調（太字）__

**これは強調（太字）**__これは強調（太字）__**これは強調（太字）**

~打ち消し線~

~~打ち消し線~~

---

------

***

*****

`Code Text`
文中に`Code Text`を含みます。

```
(() => {
  'use strict';

  console.log("Hello world");
})();
```

```javascript
(() => {
  'use strict';

  console.log("Hello world");
})();
```

```javascript:main
(() => {
  'use strict';

  console.log("Hello world");
})();
```

> "このテキストはブロッククォートです。
改行していても一つのブロッククォート要素
として扱われます。"

- item
- item
  * item
  - item
* item
  * item
    * item
    - item
- item

1. First
2. Second
3. Third
  - item
  * item
4. Fourth
  1. first
  2. second
  3. third

- [ ] task item
- [x] task item
- [X] task item

[アンカーテキスト](リンクのURL)
![altテキスト](画像のURL)
[![altテキスト](画像のURL)](リンクのURL)

脚注は[^1]こんな感じ。
[^1]: 脚注の内容
改行していても含まれる

文中に脚注^[インライン]を書くことも可能。

| head | head |      | head |
| ---- | :--- | :--: | ---: |
| item | item | item | item |
| item | item | item |
| item | item | item | item |
||item|||

:::details タイトル
表示したい内容
:::

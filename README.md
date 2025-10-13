これはあやびーの個人ページのソースコード全文です。  

使用したパッケージは以下の通り:
``` json
  // 先頭@付き(型定義のみ)は除く。一部順序入れ替え有り。
  "dependencies": { // 本番用
    "next": "^15.5.4",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    // -> 標準で入るやつ
    "nodemailer": "^7.0.9",
    "react-hook-form": "^7.65.0",
    // -> お問い合わせフォーム用
  },
  "devDependencies": { // 開発環境のみ
    "typescript": "^5.9.3",
    // -> TypeScriptの使用
    "eslint": "^9.37.0",
    "eslint-config-next": "^15.5.4",
    "prettier": "^3.6.2",
    // -> lint/フォーマッター
    "npm-check-updates": "^19.0.0",
    // -> パッケージ依存関係を最新バージョンにアップデートする
    "sass": "^1.93.2",
    "tailwindcss": "^4.1.14",
    // -> CSSまわり
  },
```

---

以下はcreate-next-app標準のREADME  
メモとして残しておく。  
ただしVercelは使用せず、VPS上で公開。   

---

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

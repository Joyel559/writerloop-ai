import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  {
    files: ["components/reader-shell.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: [
      "components/Library.tsx",
      "components/Reader.tsx",
      "components/ReaderImpl.tsx",
      "components/ReaderImplCore.tsx",
      "components/SelectionTools.tsx",
      "components/ChatSidebar.tsx",
      "components/reader/**/*.{ts,tsx}",
      "components/library/**/*.{ts,tsx}",
      "components/chat/**/*.{ts,tsx}",
      "features/insights/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default config;

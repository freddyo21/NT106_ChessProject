import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // Spread rules từ TypeScript-ESLint
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Áp dụng cho cả file JS và TS
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    // Spread rules từ cấu hình mặc định của ESLint
    rules: {
      ...js.configs.recommended.rules,
      "quotes": ["error", "double"], // Tuyệt đối dùng nháy kép theo ý bạn
      "semi": ["error", "always"],   // Kết thúc bằng dấu chấm phẩy
      "no-unused-vars": "warn",
      "no-console": "off",           // Server-side cần log nên tắt lỗi này
    },
  },
  // Custom quy tắc cho TS nếu cần
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // Cảnh báo khi dùng 'any' (quan trọng cho ATTT)
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }], // Cho phép biến không dùng nếu bắt đầu bằng '_'
    }
  },
  // Các ngoại lệ (luôn để sau cùng)
  {
    files: ["src/exceptions/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
];
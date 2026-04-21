import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/lg-washer-card.js",
  output: {
    file: "dist/lg-washer-card.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    resolve(),
    terser({
      format: { comments: false },
    }),
  ],
};

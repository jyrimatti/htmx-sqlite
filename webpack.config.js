module.exports = {
  entry: "./index.js",
  resolve: {
    extensions: [".js"],
  },
  output: {
    filename: "sqlite-wasm-http-[name].js",
    clean: true,
    asyncChunks: false,
  }
};

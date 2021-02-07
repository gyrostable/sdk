import { merge } from "webpack-merge";

import common from "./webpack.config";

export default merge(common, {
  mode: "production",
  devtool: "source-map",
});

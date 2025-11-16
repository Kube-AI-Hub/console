import { addParameters } from "@storybook/react";
import "!style-loader!css-loader!sass-loader!./styles.scss";
import * as React from "react";
// Shim React 18's useInsertionEffect for React <18 to avoid Storybook warnings
// eslint-disable-next-line no-undef
if (!("useInsertionEffect" in React)) {
  // @ts-ignore
  React.useInsertionEffect = React.useEffect;
}

addParameters({
  options: {
    /**
     * display the top-level grouping as a "root" in the sidebar
     * @type {Boolean}
     */
    showRoots: true,
  }
});

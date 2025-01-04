import { HtmlBasicTag, RsbuildPlugin } from '@rsbuild/core';

export const pluginScriptModule = (): RsbuildPlugin => ({
  name: 'plugin-script-module',
  setup: (api) => {
    api.modifyHTMLTags(({ headTags, bodyTags }) => {
      updateTags(headTags);
      updateTags(bodyTags);

      return { headTags, bodyTags };
    });
  },
});

function updateTags(tags: HtmlBasicTag[]) {
  tags.forEach((tag) => {
    if (tag.tag === 'script') {
      tag.attrs = {
        ...tag.attrs,
        type: 'module',
      };
    }
  });
}

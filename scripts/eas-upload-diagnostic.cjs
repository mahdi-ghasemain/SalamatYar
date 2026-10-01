// Report only provider error codes/messages; never log signed URLs or headers.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (id, parent, ...rest) {
  const loaded = originalLoad.call(this, id, parent, ...rest);
  if (id === './fetch' && parent?.filename.includes('eas-cli') && loaded.default && !loaded.__diagnostic) {
    const request = loaded.default;
    loaded.__diagnostic = true;
    loaded.default = async (...args) => {
      try { return await request(...args); }
      catch (error) {
        if (error.response) {
          const body = await error.response.clone().text();
          const code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
          const message = body.match(/<Message>([^<]+)<\/Message>/)?.[1];
          console.error('Upload diagnostic:', JSON.stringify({
            host: new URL(args[0]).hostname,
            status: error.response.status,
            code, message,
            htmlTitle: body.match(/<title>([^<]+)<\/title>/i)?.[1],
          }));
        }
        throw error;
      }
    };
  }
  return loaded;
};

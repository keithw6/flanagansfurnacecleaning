/* =====================================================================
   EDC Builder - the media library (optional)
   ---------------------------------------------------------------------
   Every product is drawn by js/art.js. This file is the door out of
   that: map a product id to an image and that image is used instead of
   the drawing, everywhere - catalogue card, pack list and board alike.

     window.EDC_MEDIA = {
       'bm535': 'stills/benchmade-bugout.png',      // relative to media/
       'ridgealu': 'https://example.com/ridge.png'  // or an absolute URL
     };

   Use it for real product photography, or for generated art. Two things
   to know before you do:

   1. Cut the background out and keep the image square-on and lit from
      the top left, or it will not sit with the drawings around it.
      Getting ninety photographs to agree on those two things is the
      reason the drawings exist.
   2. An absolute URL to another site taints the canvas, and "Download
      PNG" will then fail with a message saying so. A file inside
      media/ does not have that problem. Prefer local files.

   It is a .js file rather than .json on purpose: a page opened straight
   off the disk cannot fetch a local .json, and this tool is meant to
   work by double-clicking index.html.

   Products you add yourself in the app put their picture into this same
   table at runtime, so there is one code path for both. Moving one of
   those into the repo - drop the file in media/stills/ and add a line
   here - is what turns it from something only your browser knows about
   into something everyone you share the board with can see.

   Empty is the normal state. Nothing here is required.
   ===================================================================== */
window.EDC_MEDIA = {};

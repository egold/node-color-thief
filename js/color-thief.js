/*
 * Color Thief v1.0
 * by Lokesh Dhakar - http://www.lokeshdhakar.com
 *
 * Licensed under the Creative Commons Attribution 2.5 License - http://creativecommons.org/licenses/by/2.5/
 *
 * # Thanks
 * Nick Rabinowitz: Created quantize.js which is used by the median cut palette function. This handles all the hard clustering math.
 * John Schulz: All around mad genius who helped clean and optimize the code. @JFSIII
 *
 * ## Classes
 * CanvasImage
 * ## Functions
 * getDominantColor()
 * createPalette()
 * getAverageRGB()
 * createAreaBasedPalette()
 *
 * Requires jquery and quantize.js.
 */


/*
  CanvasImage Class
  Class that wraps the html image element and canvas.
  It also simplifies some of the canvas context manipulation
  with a set of helper functions.
*/

var Canvas = require('canvas')
var quantize = require('./libs/quantize.js')

var CanvasImage = function (img) {
    this.canvas = new Canvas(img.width, img.height)
    this.context = this.canvas.getContext('2d')

    this.width = img.width;
    this.height = img.height;

    this.context.drawImage(img, 0, 0, this.width, this.height);
};

CanvasImage.prototype.clear = function () {
    this.context.clearRect(0, 0, this.width, this.height);
};

CanvasImage.prototype.update = function (imageData) {
    this.context.putImageData(imageData, 0, 0);
};

CanvasImage.prototype.getPixelCount = function () {
    return this.width * this.height;
};

CanvasImage.prototype.getImageData = function () {
    return this.context.getImageData(0, 0, this.width, this.height);
};

CanvasImage.prototype.removeCanvas = function () {
    //$(this.canvas).remove();
};


/*
 * getDominantColor(sourceImage)
 * returns {r: num, g: num, b: num}
 *
 * Use the median cut algorithm provided by quantize.js to cluster similar
 * colors and return the base color from the largest cluster. */
function getDominantColor(sourceImage) {

    var palette = createPalette(sourceImage, 5);
    var dominant = palette[0];

    return dominant;
}


/*
 * createPalette(sourceImage, colorCount)
 * returns array[ {r: num, g: num, b: num}, {r: num, g: num, b: num}, ...]
 *
 * Use the median cut algorithm provided by quantize.js to cluster similar
 * colors.
 *
 * BUGGY: Function does not always return the requested amount of colors. It can be +/- 2.
 */
function createPalette(sourceImage, colorCount, filtered_colors) {

    // Create custom CanvasImage object
    var image = new CanvasImage(sourceImage),
        imageData = image.getImageData(),
        pixels = imageData.data,
        pixelCount = image.getPixelCount();

    // Store the RGB values in an array format suitable for quantize function
    var pixelArray = [];
    for (var i = 0, offset, r, g, b, a; i < pixelCount; i++) {
        offset = i * 4;
        r = pixels[offset + 0];
        g = pixels[offset + 1];
        b = pixels[offset + 2];
        a = pixels[offset + 3];
        // If pixel is mostly opaque and not white
        if (a >= 125) {
            if (filtered_colors) {
                var filter_pixel = false
                for (var j = 0; j < filtered_colors.length; j++) {
                    var filtered_color = filtered_colors[j]
                    if (r == filtered_color.r && g == filtered_color.g && b == filtered_color.b)
                    {
                        filter_pixel = true
                    }
                };
                if (!filter_pixel)
                    pixelArray.push([r, g, b]);
            }
            else {
                pixelArray.push([r, g, b]);
            }
        }
    }

    // Send array to quantize function which clusters values
    // using median cut algorithm

    var cmap = quantize(pixelArray, colorCount);
    var palette = cmap.palette();

    // Clean up
    image.removeCanvas();

    return palette;

}


/*
 * getAverageRGB(sourceImage)
 * returns {r: num, g: num, b: num}
 *
 * Add up all pixels RGB values and return average.
 * Tends to return muddy gray/brown color. Most likely, you'll be better
 * off using getDominantColor() instead.
 */
function getAverageRGB(sourceImage) {
    // Config
    var sampleSize = 10;

    // Create custom CanvasImage object
    var image = new CanvasImage(sourceImage),
        imageData = image.getImageData(),
        pixels = imageData.data,
        pixelCount = image.getPixelCount();

    // Reset vars
    var i = 0,
        count = 0,
        rgb = {r:0, g:0, b:0};

    // Loop through every # pixels. (# is set in Config above via the blockSize var)
    // Add all the red values together, repeat for blue and green.
    // Last step, divide by the number of pixels checked to get average.
    while ( (i += sampleSize * 4) < pixelCount ) {
        // if pixel is mostly opaque
        if (pixels[i+3] > 125) {
            ++count;
            rgb.r += pixels[i];
            rgb.g += pixels[i+1];
            rgb.b += pixels[i+2];
        }
    }

    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);

    return rgb;
}

/*
 * getDominantEdgeColor(sourceImage, edgeWidth)
 * returns {r: num, g: num, b: num}
 *
 * Uses pixels around outside edge of image to get average edge color. Quick way to
 * reasonably guess the background color of some types of images
 *
 * Future Improvement: return % of edge pixels that match +/- 5% of color, to know if any 
 * single color dominates
 */
function getDominantEdgeColor(sourceImage, edgeWidth) {
    var image = new CanvasImage(sourceImage),
        pixels = image.getImageData().data,
        pixelCount = image.getPixelCount();

    var i = 0,
        count = 0,
        rgb = {r:0, g:0, b:0};

    // Loop over pixels, discarding all but the edge ones
    for (var y = 0; y < image.height; y++) {
        i++;
        for (var x = 0; x < image.width; x++) {
            i++;
            //if position y == top edge     -> Y < edgeWidth
            //if position y == bottom edge  -> Y > image.height - edgeWidth
            //if position x == left edge    -> X < edgeWidth
            //if position x == right edge   -> X > image.width - edgeWidth

            if (y < edgeWidth || y > image.height - edgeWidth || x < edgeWidth || x > image.width - edgeWidth) {
                //pixel mostly opaque?
                if (pixels[i+3] > 125) {
                    ++count;
                    rgb.r += pixels[i];
                    rgb.g += pixels[i+1];
                    rgb.b += pixels[i+2];
                }
            }
        }
    }

    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);

    return rgb;
}

function getCornerColors(sourceImage) {
    var image = new CanvasImage(sourceImage),
        pixels = image.getImageData().data,
        pixelCount = image.getPixelCount();

    var corners = [];

    //corners of image in pixel coordinates
    var samplingPositions = [0, 
                             image.width - 1, 
                             image.height * image.width - image.width - 1,
                             image.height * image.width - 1];

    console.log("Extracting corner colors for image with dimensions = " + image.width + "x" + image.height);
    console.log("Total pixels: " + pixelCount);
    console.log("Pixel data length: " + pixels.length);
    for (var j = 0; j < samplingPositions.length; j++) {
        var pixelOffset = samplingPositions[j] * 4;
        console.log("Processing pixel at index " + pixelOffset);
        if (pixels[pixelOffset+3] < 125)
            continue;
        corners.push({
            r: pixels[pixelOffset],
            g: pixels[pixelOffset+1],
            b: pixels[pixelOffset+2],
        });
    };

    return corners;
}

/*
 * createAreaBasedPalette(sourceImage, colorCount)
 * returns array[ {r: num, g: num, b: num}, {r: num, g: num, b: num}, ...]
 *
 * Break the image into sections. Loops through pixel RGBS in the section and average color.
 * Tends to return muddy gray/brown color. You're most likely better off using createPalette().
 *
 * BUGGY: Function does not always return the requested amount of colors. It can be +/- 2.
 *
 */
function createAreaBasedPalette(sourceImage, colorCount) {

    var palette = [];

    // Create custom CanvasImage object
    var image = new CanvasImage(sourceImage),
        imageData = image.getImageData(),
        pixels = imageData.data,
        pixelCount = image.getPixelCount();


    // How big a pixel area does each palette color get
    var rowCount = Math.round(Math.sqrt(colorCount)),
        colCount = rowCount,
        colWidth = Math.round(image.width / colCount),
        rowHeight = Math.round(image.height / rowCount);

    // Loop through pixels section by section.
    // At the end of each section, push the average rgb color to palette array.
    for (var i = 0, vertOffset; i<rowCount; i++) {
        vertOffset = i * rowHeight * image.width * 4;

        for (var j = 0, horizOffset, rgb, count; j<colCount; j++) {
            horizOffset = j * colWidth * 4;
            rgb = {r:0, g:0, b:0};
            count = 0;

            for (var k = 0, rowOffset; k < rowHeight; k++) {
                rowOffset = k * image.width * 4;

                for (var l = 0, offset; l < colWidth; l++) {
                    offset = vertOffset + horizOffset + rowOffset + (l * 4);
                    rgb.r += pixels[offset];
                    rgb.g += pixels[offset+1];
                    rgb.b += pixels[offset+2];
                    count++;
                }

            }
            rgb.r = ~~(rgb.r/count);
            rgb.g = ~~(rgb.g/count);
            rgb.b = ~~(rgb.b/count);
            palette.push(rgb);
        }
    }

    return palette;
}

module.exports.getDominantColor = getDominantColor
module.exports.createPalette = createPalette
module.exports.getDominantEdgeColor = getDominantEdgeColor
module.exports.getCornerColors = getCornerColors
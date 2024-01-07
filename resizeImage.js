// resizeImage.js
const Jimp = require('jimp');
const path = require('path');

async function resizeImageForPDF(imagePath) {
  try {
    const image = await Jimp.read(imagePath);

    // Scale the image to fit within a 400x400 square
    image.scaleToFit(400, 400);

    

    // Convert the image to JPEG format with maximum quality
    const outputFileName = `${path.parse(imagePath).name}_resized.jpeg`;
    const outputFilePath = path.join(path.dirname(imagePath), outputFileName);
    await image.quality(100).writeAsync(outputFilePath);

    //console.log('Image resized and converted to JPEG with maximum quality.');
    return outputFilePath; // Return the output file path
  } catch (err) {
    console.error('Error resizing image:', err);
    return null; // Return null in case of error
  }
}


//resizeImageForPDF("/Users/sariksadman/work_projects/dominiks_pdf/pdfdownload/images/Assyst GmbH.jpeg")
module.exports = resizeImageForPDF;
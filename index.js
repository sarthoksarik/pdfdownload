const fs = require('fs');
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { PDFDocument, rgb } = require('pdf-lib');
const resizeImageForPDF = require('./resizeImage.js');




// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
// Set the desired working directory
const TOKEN_PATH = path.join(process.cwd(), 'assets/creds','token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'assets/creds', 'credentials.json');

/**
 * Read json for drive ID
 */
const jsonData = fs.readFileSync(path.join(process.cwd(), 'assets', 'ids.json'), 'utf8');

// Parse the JSON data
const idData = JSON.parse(jsonData);

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.promises.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.promises.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.promises.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}
/**
 * copy the temple pdf and create a client pdf
 * @returns
 */

/**
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function pdf_crt(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: idData.ssid,
    range: 'pdf_vars!G2',
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    
    return;
  }
  // this is the data from google sheets
  let pdf_data = JSON.parse(rows[0]);
  
  // company name will be used for image and pdf creation
  const companyName = pdf_data.discounts.comTitle;
  const companyRow = pdf_data.companyRow;
  const linkCol = pdf_data.linkCol;
  let imageURL = pdf_data.discounts.imgLink;
  //let imageURL = "https://drive.google.com/file/d/1IJ-H-SO8kJNnhsVP0kqpRqVd4_LWiHnn/view?usp=drive_link";
  
  const drive = google.drive({version: 'v3', auth});

  //Image Download
  
  let imageDlPath= await downloadImage(drive, imageURL, companyName);
  const imagePath = await resizeImageForPDF(imageDlPath);
  

  // create pdf file and open it
  let newFilePath = new_file(companyName); 
  const pdfBytes = fs.readFileSync(newFilePath);
  const pdfDoc = await PDFDocument.load(pdfBytes)

  //Access the formfield in pdf and modify values
  const imd = pdfDoc.getForm().getField('imported_data');
  imd.setText(JSON.stringify(pdf_data));
  
  // Some fields are static they will not change with the user input
  // Setting those fields with their respective values
  const staticFormList = ['softType', 'customerRev', 'emplRev', 'creditRating', 'companyAge',
  'total', 'compDetail', 'softTypeText'];
  staticFormList.forEach((sfield) => {
    pdfDoc.getForm().getField(sfield).setText(pdf_data.discounts[sfield])
  });
  // sumInsured Values also don't change with user inputs
  const sumInsuredFields = ['m_sumins_pi', 'l_sumins_pi', 'xl_sumins_pi', 'm_sumins_gl', 'l_sumins_gl', 'xl_sumins_gl',
  'm_deductible', 'l_deductible', 'xl_deductible'];
  // keys consecutive to sumInsureds
  const sizes = ['m', 'l', 'xl'];
  const sumInss = ['sumInsPI', 'sumInsGL', 'deductible']

  let iter = 0;
  for(const si of sumInss){
    for(const size of sizes) {
      let suminsText = pdf_data[size][si];
      pdfDoc.getForm().getField(sumInsuredFields[iter]).setText(suminsText);
      iter++;
    }
  }


  await addImagetoPDF(pdfDoc, imagePath);

  //Save file
  const modifiedBytes = await pdfDoc.save();
  fs.writeFileSync(newFilePath, modifiedBytes);

  // upload the file to drive
  const uploadedFileID = await uploadFile(auth, newFilePath);

  // get the link of the file
  const uploadedFileLink = await generateFileLink(drive, uploadedFileID);
  
  await writeLinkToSheet(sheets, uploadedFileLink, companyRow, linkCol);

  fs.unlink(imageDlPath,(err) => {
    if (err) {
      console.error('Error deleting file:', err);
      throw new Error('File deletion failed');
    }
    console.log('File deleted successfully.');
  });
  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      throw new Error('File deletion failed');
    }
    console.log('File deleted successfully.');
  })
}


authorize().then(pdf_crt).catch();
function new_file(companyName) {
  const sourceFilePath = path.join(process.cwd(), 'assets/template/updated_template.pdf'); // Replace with the path to your source PDF file
  const destinationFolderPath = path.join(process.cwd(), 'pdfs'); // Replace with the path to your destination folder

  // Check if the source file exists
  if (fs.existsSync(sourceFilePath)) {
    // Create the destination folder if it doesn't exist
    if (!fs.existsSync(destinationFolderPath)) {
      fs.mkdirSync(destinationFolderPath, { recursive: true });
    }

    const fileName = path.basename(sourceFilePath); // Extracting the file name from the source file path

    // Specify a different file name for the copied file
    const newFileName = companyName + '.pdf'; // Replace with your desired file name
    const destinationFilePath = path.join(destinationFolderPath, newFileName);

    // Copy the file to the destination folder with the new file name
    fs.copyFileSync(sourceFilePath, destinationFilePath);
    
    return destinationFilePath;
  } else {
    throw "couldn't create file"
  }
}
async function addImagetoPDF(pdfDoc, imagePath) {
  // go to page
  const imageBytes = fs.readFileSync(imagePath);

  // Embed the image in the PDF
  const image = await pdfDoc.embedJpg(imageBytes);

  // get first page
  const page = pdfDoc.getPage(0); 

  // Draw the image on the page
  const { width, height } = image.scale(0.19); // Adjust the scale factor as needed
  page.drawImage(image, {
    x: 120, // X-coordinate of the image
    y: 330, // Y-coordinate of the image
    width: width, // Width of the image
    height: height, // Height of the image
  });
}
function extractImageIdFromUrl(url) {
  const idRegex = /\/d\/([a-zA-Z0-9_-]{25,})/;
  const match = url.match(idRegex);
  
  if (match && match.length > 1) {
      return match[1];
  } else {
    console.log("Image Could not be exctracted from the URL");
    throw new Error("Image URL parsing failed")
  }
}

// upload the file to google drive

async function uploadFile(auth, filePath) {
  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: path.basename(filePath),
    parents: [idData.did]
  };
  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(filePath)
  };

  try {
    const res = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    });
    console.log("File uploaded successfully")
    return res.data.id;
  } catch (err) {
    console.log("Uploading file failed", err)
    return;
  }


}
//generate file link
async function generateFileLink(drive, fileId) {
  try {
    const res = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink'
    });
    return res.data.webViewLink;
  } catch (error) {
    throw err;
    return null;
  }
}
async function writeLinkToSheet(sheets, link, row, linkCol) {
  // Specify the details of the sheet and cell where you want to write the link
  const abc = []
  const spreadsheetId = idData.ssid; // Replace with your sheet ID
  const sheetName = 'Marketing_Data'; // Replace with your sheet name
  const range = numberToColumnLetter(linkCol) + parseInt(row); // Replace with your cell range
  const formula = `=HYPERLINK("${link}"; "Download Link")`

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${range}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[formula]]
      }
    });
    
  } catch (err) {
    console.log("Couldn't write the link to sheet", err)
    return
  }
}
function numberToColumnLetter(columnNumber) {
  let columnName = '';
  while (columnNumber > 0) {
    let remainder = (columnNumber - 1) % 26;
    columnName = String.fromCharCode(remainder + 65) + columnName;
    columnNumber = parseInt((columnNumber - remainder - 1) / 26); // Updated line
  }
  return columnName;
}

async function downloadImage(drive, imageLink, companyName) {
  let imageID = extractImageIdFromUrl(imageLink);
  const basePath = path.join(process.cwd(), 'images', companyName);
  const dest = fs.createWriteStream(`${basePath}.tmp`); // Using a temporary file name

  try {
    const response = await drive.files.get(
      { fileId: imageID, alt: 'media' },
      { responseType: 'stream' }
    );

    const contentType = response.headers['content-type'];
    let extension = '.jpeg'; // Default to JPEG if content-type is not available

    if (contentType) {
      if (contentType === 'image/png') {
        extension = '.png';
      } else if (contentType === 'image/jpeg') {
        extension = '.jpeg';
      }
      // Handle other image types if needed
    }

    const finalPath = `${basePath}${extension}`;

    response.data
      .on('error', err => {
        fs.unlinkSync(`${basePath}.tmp`); // Remove the temporary file on error
        throw err;
      })
      .pipe(dest);

    return new Promise((resolve, reject) => {
      dest.on('finish', () => {
        fs.rename(`${basePath}.tmp`, finalPath, err => {
          if (err) {
            reject(err);
          } else {
            resolve(finalPath);
          }
        });
      });
    });
  } catch (err) {
    throw "Image could not be downloaded";
  }
}



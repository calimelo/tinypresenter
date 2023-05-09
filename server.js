const package = require('./package.json');
const version = package.version;
const appname = package.name;

// const author = 'Dr.Kaan';

const express = require('express');
const http = require('http');
const showdown = require('showdown');
const path = require('path');
const fs = require('fs');
const { program } = require('commander');
const textract = require('textract');
const ip = require('ip');

const myip = ip.address();
const sqlite3 = require('sqlite3').verbose();
const sequelize = require('sequelize');
const LL = console.log; // eslint-disable-line
let LD = () => {};

console.clear();

// add options
program
  .option('-p, --port <port>', 'port number')
  .option('-f, --file <file>', 'pptx file')
  .option('-db, --database <database>', 'database file')
  .option('-n, --name <name>', 'name of the presentation')
  .option('-d, --debug <debug>', 'debug mode')
  .option('-s, --secret <secret>', 'secret password')
  .parse(process.argv);

// get options
const options = program.opts();
const port = options.port || 8000;
const file = options.file || 'none';
const filePath = path.join(process.cwd(), file);
const password = options.secret || 'none';
let database = options.database || 'none';
const newuuid = options.name || 'TinyPresenter';

if (file !== 'none') {
  LL(`📓 ${filePath}`);
}

if (options.debug) {
  LD = LL;
}
let db;
let dbwrite = false;
let sek;
let sekModel;

async function startdb() {
  dbwrite = true;
  //add .sqlite extension to database file
  if (database.indexOf('.db') === -1) {
    database = `${database}.db`;
  }
  //check if database exists
  try {
    fs.readFileSync(database, 'utf8');
  } catch (err) {
    // create database if it does not exist
    try {
      fs.writeFileSync(database, '');
    } catch (err2) {
      LD(err2);
    }
  }
  // create an sqlite3 database if it does not exist
  db = new sqlite3.Database(database, (err) => {
    if (err) {
      LD(err.message);
    }
    LD('📖🆗');
  });

  // create a table
  sek = new sequelize({
    dialect: 'sqlite',
    storage: database,
    logging: false,
  });
  sekModel = sek.define('tinypresenter', {
    id: {
      type: sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    uuid: {
      type: sequelize.STRING,
    },
    slidename: sequelize.STRING,
    slidetext: sequelize.TEXT,

    createdAt: sequelize.INTEGER,
    updatedAt: sequelize.INTEGER,
  });
  sekModel.sync().then(() => {
    // read slides from database and write to slides.json
    sekModel
      .findAll({
        where: {
          uuid: newuuid,
        },
      })
      .then((slides) => {
        const slidesObj = {};
        for (let i = 0; i < slides.length; i += 1) {
          const slidename = slides[i].slidename;
          const slidetext = slides[i].slidetext;
          slidesObj[slidename] = slidetext;
        }
        writeSlides(JSON.stringify(slidesObj), false);
      });
  });
}

const app = express();
const server = http.Server(app);
const io = require('socket.io')(server);

const converter = new showdown.Converter();

if (password !== 'none') {
  LL(`🔐 ${password}`);
}

async function writeSlides(slides, dbwrite = false) {
  if (dbwrite) {
    // write slides to database
    // create slideobj
    const slideobj = JSON.parse(slides);
    // console.log(slideobj);
    // table has 6 columns
    const newSlides = {};
    let i = 0;
    for (const key in slideobj) {
      if (Object.prototype.hasOwnProperty.call(slideobj, key)) {
        newSlides[i] = {
          uuid: newuuid,
          slidename: key,
          slidetext: slideobj[key],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        i += 1;
      }
    }
    LD(newSlides);
    //delet slides from database with the newuuid
    await sekModel
      .destroy({
        where: {
          uuid: newuuid,
        },
      })
      .then(() => {
        // write to database
        sekModel.bulkCreate(Object.values(newSlides));
      });
  }
  fs.writeFileSync('slides.json', slides);
}

// function to read pptx file
async function readPptxFile(pptxfile) {
  LD(`pptx file: ${pptxfile}`);
  // check if pptx file exists
  let mytext;
  try {
    fs.readFileSync(pptxfile, 'utf8');
  } catch (err) {
    LD(err);
    return 'none';
  }
  // extract text from pptx file
  try {
    const config = {
      preserveLineBreaks: true,
    };
    mytext = textract.fromFileWithPath(filePath, config, (error, text) => {
      if (error) {
        LD(error);
      }
      mytext = text;
      LD(`mytext: ${mytext}`);
      const slides = mytext.split('\n');
      const slideslength = slides.length;
      LD(`slideslength: ${slideslength}`);
      const slidesObj = {};
      for (let i = 0; i < slideslength; i += 1) {
        // check if slide is empty
        if (slides[i].length < 2) {
          // eslint-disable-next-line
          continue;
        }
        const slidename = `SLIDE${i + 1}`;
        slidesObj[slidename] = `#${slides[i]}`;
      }
      //   fs.writeFileSync('slides.json', JSON.stringify(slidesObj));
      writeSlides(JSON.stringify(slidesObj), dbwrite);
    });
  } catch (err) {
    LD(err);
  }
  // split text into slides

  return mytext;
}

let slides;
async function readSlides() {
  try {
    if (file !== 'none') {
      LD(`file: ${file}`);
      readPptxFile(file);
    }
    slides = fs.readFileSync('slides.json', 'utf8');
  } catch (err) {
    // create slides.json if it does not exist
    try {
      // fs.writeFileSync('slides.json', '{"SLIDE1":"#SLIDE1"}');
      writeSlides('{"SLIDE1":"#SLIDE1"}', false);
      slides = fs.readFileSync('slides.json', 'utf8');
    } catch (err2) {
      LD(err2);
    }
  }

  try {
    fs.readdirSync('images');
  } catch (err) {
    try {
      fs.mkdirSync('images');
    } catch (err2) {
      LD(err2);
    }
  }
  if (database !== 'none') {
    startdb();
  }
}
readSlides();

app.get('/edit/password/:password', (req, res) => {
  const mypassword = req.params.password;
  LD(`mypassword: ${mypassword}`);
  if (mypassword === `${password}` || password === 'none') {
    res.json('OK');
  } else {
    res.json('NO');
  }
});

app.get('/edit/slides', (req, res) => {
  const myslides = fs.readFileSync('slides.json', 'utf8');
  res.json(myslides);
});
app.get('/slides', (req, res) => {
  const myslides = fs.readFileSync('slides.json', 'utf8');
  res.json(myslides);
});

app.use('/images', express.static(path.join(process.cwd(), 'images')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'show.html'));
  // send favicon
});

app.get('/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'edit.html'));
});

io.on('connection', (socket) => {
  let socketip = socket.handshake.address;
  socketip = socketip.replace('::ffff:', '');
  LL(`${socketip} 👋`);

  socket.on('disconnect', () => {
    LL(`${socketip} 🙌`);
  });
});

function updateSlide(markdown) {
  io.emit('update slide', converter.makeHtml(markdown));
}

app.get('/api/updateSlide', (req, res) => {
  LD(`GET 'api/updateSlide' => ${JSON.stringify(req.query)}`);

  const { markdown } = req.query;

  if (markdown) {
    const myslides = fs.readFileSync('slides.json', 'utf8');
    let slidesObj = {};
    LD(`📒 ${myslides}`);
    if (typeof myslides === 'string') {
      slidesObj = JSON.parse(myslides);
    }

    const slideContents = Object.values(slidesObj);
    const slideslength = slideContents.length;
    const slideNames = Object.keys(slidesObj);

    let slideExists = false;
    let slideNeedsUpdate = false;

    for (let i = 0; i < slideslength; i += 1) {
      if (slideContents[i] === markdown) {
        slideExists = true;
        slideNeedsUpdate = false;
        LD('🤷');
        updateSlide(markdown);
        break;
      }
      if (
        // eslint-disable-next-line
        slideContents[i].includes(markdown) ||
        markdown.includes(slideContents[i])
      ) {
        slideExists = true;

        if (markdown.indexOf('🗑') > -1) {
          slideNeedsUpdate = false;

          delete slidesObj[slideNames[i]];
          // we need to resort the slides after deleting one inside the slidesObj
          LD('🗑');
          break;
        } else {
          slideNeedsUpdate = true;
          LD('🆕');
          // update the slide
          slidesObj[slideNames[i]] = markdown;
          updateSlide(markdown);
          break;
        }
      }
    }

    if (!slideExists) {
      LD('🆕');
      const slidename = `SLIDE${slideNames.length + 1}`;
      slidesObj[slidename] = markdown;
      LL('🌱');
      updateSlide(markdown);
    }
    if (slideNeedsUpdate) {
      // remove duplicates values from slidesObj and update slides.json
      const uniqueSlides = [...new Set(Object.values(slidesObj))];
      const uniqueSlideNames = [];
      const uniqueSlidesLength = uniqueSlides.length;
      for (let i = 0; i < uniqueSlidesLength; i += 1) {
        uniqueSlideNames.push(`SLIDE${i + 1}`);
      }
      slidesObj = {};
      for (let i = 0; i < uniqueSlidesLength; i += 1) {
        slidesObj[uniqueSlideNames[i]] = uniqueSlides[i];
      }

      LL('🌱');
      updateSlide(markdown);
    }
    // now we need to sort the slidesObj
    const sortedSlides = {};
    Object.keys(slidesObj)
      .sort()
      .forEach((key) => {
        sortedSlides[key] = slidesObj[key];
      });
    // now we need to update the slide names
    slidesObj = {};
    const sortedSlideNames = Object.keys(sortedSlides);
    const sortedSlideNamesLength = sortedSlideNames.length;
    for (let i = 0; i < sortedSlideNamesLength; i += 1) {
      slidesObj[`SLIDE${i + 1}`] = sortedSlides[sortedSlideNames[i]];
    }

    // fs.writeFileSync('slides.json', JSON.stringify(slidesObj));
    writeSlides(JSON.stringify(slidesObj), dbwrite);

    //
    res.status(200).send(`'updateSlide' istegi: ${markdown}\n`);
  } else {
    res.status(400).send('olmadi.\n');
  }
});

server.listen(port || 8000, () => {
  LL(`${appname} ${version} 👂\n`);
  LL('💁');
  LL(`  ${myip}:${port} \t\t=> 👁`);
  LL(`  ${myip}:${port}/edit \t=> 🖊\n`);
  LD(`slides.json: ${slides.length} bytes`);
});

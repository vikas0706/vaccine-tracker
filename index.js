var axios = require("axios");
const _ = require("lodash");
const emailTemplate = require("./emailTemplate");
const userData = require("./users.json");
var nodemailer = require("nodemailer");

const showResult = async (data, user) => {
  console.info("Showing result ");
  let filteredList = [];
  _.map(data.centers, (row) => {
    if (user.FEE_TYPE.includes(row.fee_type)) {
      _.map(row.sessions, (sec) => {
        if (sec.min_age_limit == user.MIN_AGE && sec.available_capacity > 0) {
          const item = {
            name: row.name,
            address: row.address,
            fee_type: row.fee_type,
            ...sec,
          };
          delete item.session_id;
          delete item.available_capacity;
          delete item.slots;
          delete item.min_age_limit;
          filteredList.push(item);
        }
      });
    }
  });
  console.info(`${filteredList.length} ${user.FEE_TYPE} slots found`);
  if (filteredList && filteredList.length == 0) return filteredList;
  filteredList = _.slice(filteredList, 0, user.MAX_LIST);
  await notifyByEmail(filteredList, user);
  return filteredList;
};

const notifyByEmail = async (filteredList, user) => {
  var transporter = nodemailer.createTransport({
    host: "smtp-mail.outlook.com", // hostname
    secureConnection: false, // TLS requires secureConnection to be false
    port: 587, // port for secure SMTP
    tls: {
      ciphers: "SSLv3",
    },
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  const title = `${user.NAME} | Vaccine for Age ${user.MIN_AGE} Availability at pincode: ${user.PINCODE}`;

  var mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.EMAIL,
    subject: title,
    html: emailTemplate.run({ title, filteredList }),
  };
  console.info(`sending email to ${user.EMAIL}`);
  // send mail with defined transport object
  try {
    await transporter.sendMail(mailOptions);
    console.error("Mail Sent Successfully");
  } catch (err) {
    console.error("err", err);
  }
};

const fetchCalender = async (pincode, date) => {
  console.info("Fetching data for ", pincode, date);
  var config = {
    method: "get",
    url: `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=${pincode}&date=${date}`,
    headers: {
      "sec-ch-ua":
        '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
      accept: "application/json",
      Referer: "https://apisetu.gov.in/public/marketplace/api/cowin",
      DNT: "1",
      "Accept-Language": "hi_IN",
      "sec-ch-ua-mobile": "?0",
      "User-Agent": "Chrome",
    },
  };
  console.info("config created");
  try {
    console.info("Sending request");
    const response = await axios(config);
    console.error("Successfull fetch");
    return {
      status: 200,
      data: response.data,
    };
  } catch (err) {
    console.error("Error while fetching result ", err);
    return {
      status: 500,
      err,
    };
  }
};
const getDate = () => {
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  if (dd < 10) dd = "0" + dd;
  if (mm < 10) mm = "0" + mm;
  return dd + "-" + mm + "-" + yyyy;
};
const execScript = async (user) => {
  console.info("executing");
  const { status, data, err } = await fetchCalender(user.PINCODE, getDate());
  console.info("fetch complete");
  if (status == 200) await showResult(data, user);
};

exports.handler = async (event) => {
  await Promise.all(userData.map((user) => execScript(user)));
  return;
};

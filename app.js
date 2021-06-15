const express = require('express');
const sqlite3 = require('sqlite3');
const nunjucks = require('nunjucks');
const nunjucksDateFilter = require('nunjucks-date-filter');

const EXPRESS_HOST = '0.0.0.0';
const EXPRESS_PORT = 3000;
const NUNJUCKS_TEMPLATE_DIR = './templates/'

const db = new sqlite3.Database('./db/database.db3');
const app = express();

app.use(express.static('public'));

const njInstance = nunjucks.configure(NUNJUCKS_TEMPLATE_DIR, {
    autoescape: true,
    express: app,
    noCache: true,
});

njInstance.addFilter('date', nunjucksDateFilter);

function getData(callback) {
    let query = `
    SELECT 
      docs.date as date,
      docs.id as orderId, 
      docTypes.name as orderType, 
      products.name as productName, 
      products.image as productImage, 
      products.price as productPrice, 
      products.removed as productUnlisted, 
      rows.quantity as productQuantity
    FROM docs
    JOIN docTypes ON docs.typeId = docTypes.id
    JOIN rows ON rows.docId = docs.id
    JOIN products ON rows.productid = products.id
    WHERE docTypes.removed = 0 AND docs.removed = 0
    ORDER BY docs.date ASC
  `;

  db.all(query, [], (err, rows) => {
      callback(err, rows);
  });
}

app.get('/', function (req, res, next) {
    getData((err, data) => {
        if (err) return next(err);

        const orders = {};
        const ordersByDay = {};

        data.forEach(item => {
            if (orders[item.orderId] == null) {
                orders[item.orderId] = {
                    id: item.orderId,
                    date: item.date,
                    type: item.orderType,
                    totalAmount: 0,
                    items: [],
                };
            }

            const quantity = item.productQuantity;
            const price = item.productPrice;

            orders[item.orderId].items.push({
                name: item.productName,
                image: item.productImage,
                price: price,
                quantity: quantity,
                unlisted: item.productUnlisted,
            });

            orders[item.orderId].totalAmount += price * quantity;
        });

        Object.values(orders).forEach(order => {
            // const date = new Date(Date.parse(`${order.date} GMT`));
            // const stringifiedDate = date.toISOString().slice(0, 10);
            
            const date = order.date.slice(0, 10);

            if (!ordersByDay[date]) {
                ordersByDay[date] = {
                    totalAmount: 0,
                    orders: [],
                };
            }

            ordersByDay[date].orders.push(order);
            ordersByDay[date].totalAmount += order.totalAmount;
        });


        res.render('index.html', { data, orders, ordersByDay });
    });    
});


app.get('/data.json', function (req, res, next) {
    getData((err, data) => {
        if (err) return next(err);
        res.send(data);
    });
});


app.listen(EXPRESS_PORT, EXPRESS_HOST, () => {
    console.log('Server up on port ' + EXPRESS_PORT)
});
import sqlite3
from flask import Flask, render_template, request, jsonify, g
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

DATABASE = os.path.join(app.root_path, 'farmconnect.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            user_type TEXT NOT NULL
        )''')
        cursor.execute('''CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            image TEXT,
            FOREIGN KEY (farmer_id) REFERENCES users(user_id)
        )''')
        db.commit()

def upgrade_orders_table():
    with app.app_context():
        db = get_db()
        db.execute('''CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            buyer_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (buyer_id) REFERENCES users(user_id),
            FOREIGN KEY (product_id) REFERENCES products(product_id)
        )''')
        db.commit()

# ----------------------
# HTML Page Routes
# ----------------------
@app.route('/')
def home(): return render_template('index.html')

@app.route('/login')
def login(): return render_template('login.html')

@app.route('/register')
def register(): return render_template('register.html')

@app.route('/farmer')
def farmer_dashboard(): return render_template('farmer_dashboard.html')

@app.route('/buyer')
def buyer_dashboard(): return render_template('buyer_dashboard.html')

@app.route('/add_product')
def add_product(): return render_template('add_product.html')

@app.route('/edit_product')
def edit_product(): return render_template('edit_product.html')

@app.route('/product')
def product_detail(): return render_template('product_detail.html')

@app.route('/payment')
def payment(): return render_template('payment.html')

@app.route('/cart')
def cart(): return render_template('cart.html')


# ----------------------
# API Routes
# ----------------------
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    db = get_db()
    try:
        db.execute("INSERT INTO users (name, email, password, user_type) VALUES (?, ?, ?, ?)",
                   (data['name'], data['email'], data['password'], data['user_type']))
        db.commit()
        return jsonify(message="User registered successfully"), 201
    except sqlite3.IntegrityError:
        return jsonify(error="Email already registered"), 409

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email=? AND password=?", 
                      (data['email'], data['password'])).fetchone()
    if user:
        return jsonify(message="Login successful", user_type=user['user_type'], user_id=user['user_id']), 200
    return jsonify(error="Invalid credentials"), 401

@app.route('/api/products', methods=['POST'])
def api_add_product():
    data = request.get_json()
    db = get_db()
    db.execute('''INSERT INTO products (farmer_id, product_name, description, price, quantity, image)
                  VALUES (?, ?, ?, ?, ?, ?)''',
               (data['farmer_id'], data['product_name'], data['description'],
                data['price'], data['quantity'], data['image']))
    db.commit()
    return jsonify(message="Product added successfully"), 201

@app.route('/api/products', methods=['GET'])
def api_get_all_products():
    db = get_db()
    products = db.execute("SELECT * FROM products").fetchall()
    return jsonify([dict(row) for row in products])

@app.route('/api/products/farmer/<int:farmer_id>', methods=['GET'])
def api_get_farmer_products(farmer_id):
    db = get_db()
    products = db.execute("SELECT * FROM products WHERE farmer_id=?", (farmer_id,)).fetchall()
    return jsonify([dict(row) for row in products])

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product_by_id(product_id):
    db = get_db()
    product = db.execute("SELECT * FROM products WHERE product_id = ?", (product_id,)).fetchone()
    if product:
        return jsonify(dict(product)), 200
    return jsonify(error="Product not found"), 404

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.get_json()
    db = get_db()
    db.execute('''UPDATE products SET product_name=?, description=?, price=?, quantity=?, image=? 
                  WHERE product_id = ?''',
               (data['product_name'], data['description'], data['price'], 
                data['quantity'], data['image'], product_id))
    db.commit()
    return jsonify(message="Product updated successfully"), 200

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    db = get_db()
    db.execute("DELETE FROM products WHERE product_id = ?", (product_id,))
    db.commit()
    return jsonify(message="Product deleted successfully"), 200

@app.route('/api/payments', methods=['POST'])
def api_payment():
    data = request.get_json()
    return jsonify(message="Payment processed", transaction_id=f"TXN{data['product_id']}{data['buyer_id']}"), 200

@app.route('/api/orders', methods=['POST'])
def place_order():
    data = request.get_json()
    db = get_db()
    orders = data.get('orders', [])
    buyer_id = data.get('buyer_id')
    if not buyer_id or not orders:
        return jsonify(error="Missing order data"), 400
    for item in orders:
        db.execute('''INSERT INTO orders (buyer_id, product_id, quantity)
                      VALUES (?, ?, ?)''',
                   (buyer_id, item['product_id'], item['quantity']))
    db.commit()
    return jsonify(message="Order placed successfully"), 201

@app.route('/api/orders/buyer/<int:buyer_id>', methods=['GET'])
def get_orders_by_buyer(buyer_id):
    db = get_db()
    result = db.execute('''SELECT o.order_id, o.quantity, o.status, 
                           p.product_name, p.price
                           FROM orders o JOIN products p ON o.product_id = p.product_id
                           WHERE o.buyer_id = ?''', (buyer_id,)).fetchall()
    return jsonify([dict(row) for row in result])

# ----------------------
# App Entry
# ----------------------
@app.before_first_request
def initialize_database():
    init_db()
    upgrade_orders_table()

if __name__ == '__main__':
    app.run(debug=True)

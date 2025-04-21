document.addEventListener('DOMContentLoaded', () => {
    // Handle login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const email = document.getElementById('login_email').value;
            const password = document.getElementById('login_password').value;
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Login successful!');
                    // Redirect based on user type (for demo, using a simple logic)
                    window.location.href = data.user_type === 'farmer' ? '/farmer' : '/buyer';
                } else {
                    showToast(data.error || 'Login failed', 'error');
                }
            } catch (err) {
                showToast('Error connecting to server.', 'error');
            }
        });
    }

    // Handle registration form submission
    const regForm = document.getElementById('registration-form');
    if (regForm) {
        regForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const user_type = document.getElementById('user_type').value;
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, user_type })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Registered successfully!');
                    window.location.href = '/login';
                } else {
                    showToast(data.error || 'Registration failed', 'error');
                }
            } catch (err) {
                showToast('Error connecting to server.', 'error');
            }
        });
    }

    // Handle product form submission for farmers
    const productForm = document.getElementById('add-product-form');
    if (productForm) {
        // Live image preview
        const fileInput = document.getElementById('product_image');
        const preview = document.getElementById('product-image-preview');
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    preview.src = reader.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        });

        productForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const farmer_id = document.getElementById('farmer_id_input').value;
            const product_name = document.getElementById('product_name').value;
            const description = document.getElementById('description').value;
            const price = document.getElementById('price').value;
            const quantity = document.getElementById('quantity').value;
            // For demo purposes, we're using a placeholder for the image name.
            const image = 'placeholder.jpg';
            try {
                const res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ farmer_id, product_name, description, price, quantity, image })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Product added successfully!');
                    window.location.href = '/farmer';
                } else {
                    showToast(data.error || 'Failed to add product', 'error');
                }
            } catch (err) {
                showToast('Error connecting to server.', 'error');
            }
        });
    }

    // Handle payment form submission
    const payForm = document.getElementById('payment-form');
    if (payForm) {
        payForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            // Assuming there's at least one payment method selected
            const methodRadio = document.querySelector('input[name="payment_method"]:checked');
            if (!methodRadio) {
                showToast('Select a payment method.', 'error');
                return;
            }
            const payment_method = methodRadio.value;
            // For demo, using dummy product_id and buyer_id
            try {
                const res = await fetch('/api/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_method, product_id: 1, buyer_id: 1 })
                });
                const data = await res.json();
                if (res.ok) {
                    document.getElementById('payment-confirmation-section').style.display = 'block';
                    document.getElementById('receipt-txn').innerText = data.transaction_id;
                    document.getElementById('receipt-date').innerText = new Date().toLocaleDateString();
                    showToast('Payment successful!');
                } else {
                    showToast(data.error || 'Payment failed', 'error');
                }
            } catch (err) {
                showToast('Error connecting to server.', 'error');
            }
        });
    }
});

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.textContent = message;
    if (type === 'error') {
        toast.style.background = '#e74c3c';
    }
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
// === Product Cards: Add to Cart ===
function addToCart(product) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');

    const exists = cart.find(item => item.product_id === product.product_id);
    if (exists) {
        exists.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    alert(`${product.product_name} added to cart!`);
}

// === Load Products for Buyer ===
function loadMarketplace() {
    fetch('/api/products')
        .then(res => res.json())
        .then(products => {
            const list = document.getElementById('market-list');
            const search = document.getElementById('search');
            const render = (items) => {
                list.innerHTML = items.map(p => `
                    <li>
                        <strong>${p.product_name}</strong><br>
                        ${p.description}<br>
                        Price: $${p.price}<br>
                        Qty: ${p.quantity}<br>
                        <button onclick='addToCart(${JSON.stringify(p)})'>Add to Cart</button>
                    </li>
                `).join('');
            };
            render(products);
            if (search) {
                search.addEventListener('input', () => {
                    const q = search.value.toLowerCase();
                    const filtered = products.filter(p => p.product_name.toLowerCase().includes(q));
                    render(filtered);
                });
            }
        });
}

// === Farmer Dashboard Loader ===
function loadFarmerProducts(farmerId = 1) {
    fetch(`/api/products/farmer/${farmerId}`)
        .then(res => res.json())
        .then(products => {
            const list = document.getElementById('my-product-list');
            if (products.length === 0) {
                list.innerHTML = '<li>No products yet</li>';
            } else {
                list.innerHTML = products.map(p => `
                    <li>
                        <strong>${p.product_name}</strong><br>
                        ${p.description}<br>
                        Price: $${p.price} | Qty: ${p.quantity}<br>
                        <button onclick="location.href='/edit_product?id=${p.product_id}'">Edit</button>
                        <button onclick="deleteProduct(${p.product_id})">Delete</button>
                    </li>`).join('');
            }
        });
}

function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        fetch('/api/products/' + id, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                location.reload();
            });
    }
}

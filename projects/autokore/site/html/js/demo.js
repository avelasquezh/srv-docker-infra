// app.js - Lógica unificada extraída

// ======================
// Variables globales
// ======================
const appState = {
    user: null,
    cart: [],
    products: [],
};

// ======================
// Inicialización
// ======================
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    bindEvents();
    loadInitialData();
}

// ======================
// Eventos
// ======================
function bindEvents() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    const buttons = document.querySelectorAll(".btn-add-cart");
    buttons.forEach(btn => {
        btn.addEventListener("click", handleAddToCart);
    });
}

// ======================
// Lógica de usuario
// ======================
function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
        alert("Campos obligatorios");
        return;
    }

    // Simulación de login
    appState.user = { email };
    console.log("Usuario autenticado:", appState.user);
}

// ======================
// Lógica de carrito
// ======================
function handleAddToCart(e) {
    const productId = e.target.dataset.id;

    const product = appState.products.find(p => p.id == productId);
    if (!product) return;

    appState.cart.push(product);
    console.log("Carrito:", appState.cart);
}

// ======================
// Datos iniciales
// ======================
function loadInitialData() {
    // Simulación de productos
    appState.products = [
        { id: 1, name: "Producto 1", price: 100 },
        { id: 2, name: "Producto 2", price: 200 }
    ];
}

// ======================
// Utilidades
// ======================
function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP"
    }).format(value);
}

// ======================
// Debug
// ======================
window.appState = appState;
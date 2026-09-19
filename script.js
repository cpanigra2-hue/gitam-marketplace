let allProducts = [];

// =====================================
// PAGE LOAD
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    setupSellModal();
    setupSearch();
    setupCategories();
    setupSellForm();
    loadProducts();
});


// =====================================
// SELL MODAL
// =====================================

function setupSellModal() {

    const sellButton = document.getElementById("sellBtn");
    const sellModal = document.getElementById("sellModal");
    const closeSellModal = document.getElementById("closeSellModal");

    if (sellButton && sellModal) {
        sellButton.addEventListener("click", () => {
            sellModal.style.display = "flex";
        });
    }

    if (closeSellModal && sellModal) {
        closeSellModal.addEventListener("click", () => {
            sellModal.style.display = "none";
        });
    }

    if (sellModal) {
        sellModal.addEventListener("click", (event) => {

            if (event.target === sellModal) {
                sellModal.style.display = "none";
            }

        });
    }
}


// =====================================
// SEARCH
// =====================================

function setupSearch() {

    const searchInput = document.getElementById("searchInput");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {

        const searchText =
            searchInput.value.toLowerCase().trim();

        const filtered = allProducts.filter(product => {

            return (
                String(product.name || "")
                    .toLowerCase()
                    .includes(searchText) ||

                String(product.description || "")
                    .toLowerCase()
                    .includes(searchText) ||

                String(product.category || "")
                    .toLowerCase()
                    .includes(searchText)
            );

        });

        displayProducts(filtered);
    });
}


// =====================================
// CATEGORY FILTER
// =====================================

function setupCategories() {

    const categoryButtons =
        document.querySelectorAll(".category-btn");

    categoryButtons.forEach(button => {

        button.addEventListener("click", () => {

            categoryButtons.forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            const category =
                button.dataset.category ||
                button.textContent.trim();

            if (
                category.toLowerCase() === "all"
            ) {

                displayProducts(allProducts);
                return;
            }

            const filtered =
                allProducts.filter(product =>
                    String(product.category || "")
                        .toLowerCase() ===
                    category.toLowerCase()
                );

            displayProducts(filtered);
        });
    });
}


// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {

    const container =
        document.getElementById("productsContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="loading">
            Loading products...
        </div>
    `;

    try {

        const response =
            await fetch("/api/products");

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Failed to load products"
            );
        }

        allProducts = Array.isArray(data)
            ? data
            : [];

        displayProducts(allProducts);

    } catch (error) {

        console.error(
            "Error loading products:",
            error
        );

        container.innerHTML = `
            <div class="empty-message">
                <h3>Unable to load products</h3>
                <p>Please refresh the page.</p>
            </div>
        `;
    }
}


// =====================================
// DISPLAY PRODUCTS
// =====================================

function displayProducts(products) {

    const container =
        document.getElementById("productsContainer");

    if (!container) return;

    if (!products || products.length === 0) {

        container.innerHTML = `
            <div class="empty-message">
                <h3>No products found</h3>
                <p>Be the first student to sell something!</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        products.map(product => {

            const imageHTML =
                product.image
                    ? `
                        <img
                            src="${escapeHTML(product.image)}"
                            alt="${escapeHTML(product.name)}"
                            class="product-image"
                            onerror="this.style.display='none';"
                        >
                    `
                    : `
                        <div class="no-image">
                            📦
                        </div>
                    `;

            return `
                <div
                    class="product-card"
                    onclick="showProductDetails(${product.id})"
                >

                    <div class="product-image-container">
                        ${imageHTML}
                    </div>

                    <div class="product-info">

                        <div class="product-category">
                            ${escapeHTML(product.category)}
                        </div>

                        <h3>
                            ${escapeHTML(product.name)}
                        </h3>

                        <div class="product-price">
                            ₹${Number(product.price).toLocaleString("en-IN")}
                        </div>

                        <p class="product-description">
                            ${escapeHTML(
                                product.description || "No description"
                            )}
                        </p>

                        <div class="seller-info">
                            👤 ${escapeHTML(
                                product.seller_name || "Seller"
                            )}
                        </div>

                    </div>

                </div>
            `;

        }).join("");
}


// =====================================
// SELL FORM
// =====================================

function setupSellForm() {

    const form =
        document.getElementById("sellForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const submitButton =
            form.querySelector(
                'button[type="submit"]'
            );

        const originalText =
            submitButton
                ? submitButton.textContent
                : "";

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
                "Submitting...";
        }

        try {

            const sellerEmail =
                document.getElementById(
                    "sellerEmail"
                )?.value.trim();

            const sellerPhone =
                document.getElementById(
                    "sellerPhone"
                )?.value.trim();

            // -----------------------------
            // GITAM EMAIL VALIDATION
            // -----------------------------

            if (
                !sellerEmail.toLowerCase().endsWith("@gitam.in") &&
                !sellerEmail.toLowerCase().endsWith("@gitam.edu")
            ) {

                alert(
                    "Please use your GITAM email address.\n\nExample: yourname@gitam.in"
                );

                return;
            }

            // -----------------------------
            // PHONE VALIDATION
            // -----------------------------

            const cleanPhone =
                sellerPhone.replace(/\D/g, "");

            if (cleanPhone.length < 10) {

                alert(
                    "Please enter a valid 10-digit phone number."
                );

                return;
            }

            // -----------------------------
            // FORM DATA
            // -----------------------------

            const formData =
                new FormData(form);

            // Make sure cleaned phone is sent
            formData.set(
                "seller_phone",
                cleanPhone
            );

            // -----------------------------
            // SEND TO SERVER
            // -----------------------------

            const response =
                await fetch(
                    "/api/products",
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "Failed to submit product"
                );
            }

            // -----------------------------
            // SUCCESS
            // -----------------------------

            alert(
                "Product submitted successfully! 🎉\n\nYour product is now waiting for admin approval."
            );

            form.reset();

            const modal =
                document.getElementById(
                    "sellModal"
                );

            if (modal) {
                modal.style.display = "none";
            }

            await loadProducts();

        } catch (error) {

            console.error(
                "Submit error:",
                error
            );

            alert(
                error.message ||
                "Something went wrong. Please try again."
            );

        } finally {

            if (submitButton) {

                submitButton.disabled = false;
                submitButton.textContent =
                    originalText || "Sell Item";
            }
        }
    });
}


// =====================================
// PRODUCT DETAILS
// =====================================

async function showProductDetails(id) {

    try {

        const response =
            await fetch(
                `/api/products/${id}`
            );

        const product =
            await response.json();

        if (!response.ok) {

            throw new Error(
                product.error ||
                "Product not found"
            );
        }

        openProductDetails(product);

    } catch (error) {

        console.error(
            "Product details error:",
            error
        );

        alert(
            error.message ||
            "Unable to load product details."
        );
    }
}


// =====================================
// OPEN PRODUCT DETAILS MODAL
// =====================================

function openProductDetails(product) {

    const modal =
        document.getElementById(
            "detailsModal"
        );

    const content =
        document.getElementById(
            "detailsContent"
        );

    if (!modal || !content) return;

    const imageHTML =
        product.image
            ? `
                <img
                    src="${escapeHTML(product.image)}"
                    alt="${escapeHTML(product.name)}"
                    class="details-image"
                >
            `
            : `
                <div class="details-no-image">
                    📦
                </div>
            `;

    const phone =
        String(
            product.seller_phone || ""
        ).replace(/\D/g, "");

    const whatsappNumber =
        phone.length === 10
            ? "91" + phone
            : phone;

    const whatsappMessage =
        encodeURIComponent(
            `Hi ${product.seller_name || ""}, I am interested in your product "${product.name}" listed on GITAM Marketplace.`
        );

    content.innerHTML = `

        <div class="details-layout">

            <div class="details-image-container">
                ${imageHTML}
            </div>

            <div class="details-info">

                <div class="product-category">
                    ${escapeHTML(product.category)}
                </div>

                <h2>
                    ${escapeHTML(product.name)}
                </h2>

                <div class="details-price">
                    ₹${Number(product.price).toLocaleString("en-IN")}
                </div>

                <div class="details-section">

                    <h4>Description</h4>

                    <p>
                        ${escapeHTML(
                            product.description ||
                            "No description provided."
                        )}
                    </p>

                </div>

                <div class="details-section">

                    <h4>Seller</h4>

                    <p>
                        👤 ${escapeHTML(
                            product.seller_name ||
                            "Seller"
                        )}
                    </p>

                    <p>
                        📧 ${escapeHTML(
                            product.seller_email ||
                            ""
                        )}
                    </p>

                    <p>
                        📱 ${escapeHTML(
                            product.seller_phone ||
                            ""
                        )}
                    </p>

                </div>

                <div class="details-actions">

                    ${
                        whatsappNumber
                            ? `
                                <a
                                    href="https://wa.me/${whatsappNumber}?text=${whatsappMessage}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="whatsapp-button"
                                >
                                    💬 Contact Seller on WhatsApp
                                </a>
                            `
                            : ""
                    }

                </div>

            </div>

        </div>
    `;

    modal.style.display = "flex";

    const closeButton =
        document.getElementById(
            "closeDetailsModal"
        );

    if (closeButton) {

        closeButton.onclick = () => {
            modal.style.display = "none";
        };
    }

    modal.onclick = (event) => {

        if (event.target === modal) {
            modal.style.display = "none";
        }
    };
}


// =====================================
// ESCAPE HTML
// =====================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================
// MAKE FUNCTIONS AVAILABLE
// =====================================

window.showProductDetails =
    showProductDetails;

window.loadProducts =
    loadProducts;
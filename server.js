require("dotenv").config();

const express = require("express");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// =================================
// DATABASE
// =================================

const db = new Database("marketplace.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        image TEXT,
        seller_name TEXT NOT NULL,
        seller_phone TEXT NOT NULL,
        seller_email TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

console.log("Database initialized");

// =================================
// UPLOAD FOLDER
// =================================

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {

        const allowed = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
        }
    }
});

// =================================
// MIDDLEWARE
// =================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use("/uploads", express.static(uploadDir));

// =================================
// HOME
// =================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});


// =================================
// GET APPROVED PRODUCTS
// =================================

app.get("/api/products", (req, res) => {

    try {

        const products = db.prepare(`
            SELECT
                id,
                name,
                price,
                category,
                description,
                image,
                seller_name,
                seller_phone,
                seller_email,
                status,
                created_at
            FROM products
            WHERE status = 'APPROVED'
            ORDER BY id DESC
        `).all();

        res.json(products);

    } catch (error) {

        console.error("Error loading products:", error);

        res.status(500).json({
            error: "Failed to load products"
        });
    }
});

// =================================
// GET SINGLE PRODUCT
// =================================

app.get("/api/products/:id", (req, res) => {

    try {

        const id = Number(req.params.id);

        const product = db.prepare(`
            SELECT *
            FROM products
            WHERE id = ? AND status = 'APPROVED'
        `).get(id);

        if (!product) {

            return res.status(404).json({
                error: "Product not found"
            });
        }

        res.json(product);

    } catch (error) {

        console.error("Error loading product:", error);

        res.status(500).json({
            error: "Failed to load product"
        });
    }
});

// =================================
// POST NEW PRODUCT
// =================================

app.post("/api/products", upload.single("image"), (req, res) => {

    try {

        const {
            name,
            price,
            category,
            description,
            seller_name,
            seller_phone,
            seller_email
        } = req.body;

        // -----------------------------
        // REQUIRED FIELDS
        // -----------------------------

        if (
            !name ||
            !price ||
            !category ||
            !seller_name ||
            !seller_phone ||
            !seller_email
        ) {

            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {}
            }

            return res.status(400).json({
                error: "Please fill all required fields"
            });
        }

        // -----------------------------
        // GITAM EMAIL
        // -----------------------------

        if (!isGitamEmail(seller_email)) {

            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {}
            }

            return res.status(400).json({
                error: "Only GITAM email addresses are allowed"
            });
        }

        // -----------------------------
        // PRICE VALIDATION
        // -----------------------------

        const numericPrice = Number(price);

        if (
            Number.isNaN(numericPrice) ||
            numericPrice < 0
        ) {

            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {}
            }

            return res.status(400).json({
                error: "Invalid price"
            });
        }

        // -----------------------------
        // PHONE VALIDATION
        // -----------------------------

        const cleanPhone = String(seller_phone)
            .replace(/\D/g, "");

        if (cleanPhone.length < 10) {

            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {}
            }

            return res.status(400).json({
                error: "Please enter a valid phone number"
            });
        }

        // -----------------------------
        // IMAGE
        // -----------------------------

        let imagePath = null;

        if (req.file) {
            imagePath = "/uploads/" + req.file.filename;
        }

        // -----------------------------
        // INSERT
        // -----------------------------

        const result = db.prepare(`
            INSERT INTO products (
                name,
                price,
                category,
                description,
                image,
                seller_name,
                seller_phone,
                seller_email,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).run(
            name.trim(),
            numericPrice,
            category.trim(),
            description ? description.trim() : "",
            imagePath,
            seller_name.trim(),
            cleanPhone,
            seller_email.toLowerCase().trim()
        );

        console.log(
            `New product submitted: ${name} | ID: ${result.lastInsertRowid}`
        );

        res.json({
            success: true,
            message:
                "Product submitted successfully! 🎉 Your product is now waiting for admin approval.",
            id: result.lastInsertRowid
        });

    } catch (error) {

        console.error("Error creating product:", error);

        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }

        res.status(500).json({
            error: "Failed to submit product"
        });
    }
});

// =================================
// DELETE PRODUCT
// =================================

app.delete("/api/products/:id", (req, res) => {

    try {

        const id = Number(req.params.id);

        const product = db.prepare(`
            SELECT image
            FROM products
            WHERE id = ?
        `).get(id);

        if (!product) {

            return res.status(404).json({
                error: "Product not found"
            });
        }

        // Delete image
        if (product.image) {

            const imageFile = path.join(
                __dirname,
                product.image.replace(/^\/+/, "")
            );

            if (fs.existsSync(imageFile)) {

                try {
                    fs.unlinkSync(imageFile);
                } catch (e) {
                    console.log("Could not delete image:", e.message);
                }
            }
        }

        db.prepare(`
            DELETE FROM products
            WHERE id = ?
        `).run(id);

        console.log(`Product deleted: ${id}`);

        res.json({
            success: true,
            message: "Product deleted successfully"
        });

    } catch (error) {

        console.error("Error deleting product:", error);

        res.status(500).json({
            error: "Failed to delete product"
        });
    }
});

// =================================
// ADMIN PASSWORD FROM .ENV
// =================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {

    console.error("");
    console.error("=================================");
    console.error("ERROR: ADMIN_PASSWORD is missing");
    console.error("=================================");
    console.error("");
    console.error("Create a .env file in the project folder:");
    console.error("");
    console.error("ADMIN_PASSWORD=your_password");
    console.error("");

    process.exit(1);
}

// =================================
// ADMIN AUTHENTICATION
// =================================

function authenticateAdmin(req, res, next) {

    const password = req.headers["x-admin-password"];

    if (!password) {

        return res.status(401).json({
            error: "Admin password required"
        });
    }

    if (password !== ADMIN_PASSWORD) {

        return res.status(403).json({
            error: "Invalid admin password"
        });
    }

    next();
}

// =================================
// ADMIN LOGIN CHECK
// =================================

app.post("/api/admin/login", (req, res) => {

    const password =
        req.body.password ||
        req.headers["x-admin-password"];

    if (!password) {

        return res.status(400).json({
            error: "Password required"
        });
    }

    if (password !== ADMIN_PASSWORD) {

        return res.status(401).json({
            error: "Invalid admin password"
        });
    }

    res.json({
        success: true,
        message: "Admin login successful"
    });
});

// =================================
// ADMIN GET ALL PRODUCTS
// =================================

app.get(
    "/api/admin/products",
    authenticateAdmin,
    (req, res) => {

        try {

            const products = db.prepare(`
                SELECT *
                FROM products
                ORDER BY
                    CASE status
                        WHEN 'PENDING' THEN 1
                        WHEN 'APPROVED' THEN 2
                        WHEN 'REJECTED' THEN 3
                        ELSE 4
                    END,
                    id DESC
            `).all();

            res.json(products);

        } catch (error) {

            console.error(
                "Error loading admin products:",
                error
            );

            res.status(500).json({
                error: "Failed to load products"
            });
        }
    }
);

// =================================
// ADMIN APPROVE / REJECT
// =================================

app.patch(
    "/api/admin/products/:id/status",
    authenticateAdmin,
    (req, res) => {

        try {

            const id = Number(req.params.id);

            const status = String(
                req.body.status || ""
            ).toUpperCase();

            if (
                status !== "APPROVED" &&
                status !== "REJECTED" &&
                status !== "PENDING"
            ) {

                return res.status(400).json({
                    error: "Invalid status"
                });
            }

            const product = db.prepare(`
                SELECT *
                FROM products
                WHERE id = ?
            `).get(id);

            if (!product) {

                return res.status(404).json({
                    error: "Product not found"
                });
            }

            db.prepare(`
                UPDATE products
                SET status = ?
                WHERE id = ?
            `).run(status, id);

            console.log(
                `Product ${id} status changed to ${status}`
            );

            res.json({
                success: true,
                message: `Product ${status.toLowerCase()} successfully`,
                status
            });

        } catch (error) {

            console.error(
                "Error changing product status:",
                error
            );

            res.status(500).json({
                error: "Failed to update product status"
            });
        }
    }
);

// =================================
// ADMIN DELETE PRODUCT
// =================================

app.delete(
    "/api/admin/products/:id",
    authenticateAdmin,
    (req, res) => {

        try {

            const id = Number(req.params.id);

            const product = db.prepare(`
                SELECT image
                FROM products
                WHERE id = ?
            `).get(id);

            if (!product) {

                return res.status(404).json({
                    error: "Product not found"
                });
            }

            // Delete image
            if (product.image) {

                const imageFile = path.join(
                    __dirname,
                    product.image.replace(/^\/+/, "")
                );

                if (fs.existsSync(imageFile)) {

                    try {
                        fs.unlinkSync(imageFile);
                    } catch (e) {}
                }
            }

            db.prepare(`
                DELETE FROM products
                WHERE id = ?
            `).run(id);

            console.log(
                `Admin deleted product: ${id}`
            );

            res.json({
                success: true,
                message: "Product deleted successfully"
            });

        } catch (error) {

            console.error(
                "Admin delete error:",
                error
            );

            res.status(500).json({
                error: "Failed to delete product"
            });
        }
    }
);

// =================================
// ADMIN STATISTICS
// =================================

app.get(
    "/api/admin/stats",
    authenticateAdmin,
    (req, res) => {

        try {

            const total = db.prepare(`
                SELECT COUNT(*) AS count
                FROM products
            `).get().count;

            const pending = db.prepare(`
                SELECT COUNT(*) AS count
                FROM products
                WHERE status = 'PENDING'
            `).get().count;

            const approved = db.prepare(`
                SELECT COUNT(*) AS count
                FROM products
                WHERE status = 'APPROVED'
            `).get().count;

            const rejected = db.prepare(`
                SELECT COUNT(*) AS count
                FROM products
                WHERE status = 'REJECTED'
            `).get().count;

            res.json({
                total,
                pending,
                approved,
                rejected
            });

        } catch (error) {

            console.error(
                "Error loading statistics:",
                error
            );

            res.status(500).json({
                error: "Failed to load statistics"
            });
        }
    }
);

// =================================
// ERROR HANDLER
// =================================

app.use((err, req, res, next) => {

    console.error("Server error:", err);

    if (err instanceof multer.MulterError) {

        if (err.code === "LIMIT_FILE_SIZE") {

            return res.status(400).json({
                error: "Image is too large. Maximum size is 5MB."
            });
        }

        return res.status(400).json({
            error: err.message
        });
    }

    if (
        err &&
        err.message &&
        err.message.includes("Only JPG")
    ) {

        return res.status(400).json({
            error: err.message
        });
    }

    res.status(500).json({
        error: "Something went wrong on the server"
    });
});

// =================================
// START SERVER
// =================================

app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("     GITAM MARKETPLACE SERVER");
    console.log("=================================");
    console.log("");
    console.log(`Website: http://localhost:${PORT}`);
    console.log("Database: marketplace.db");
    console.log("Uploads: uploads/");
    console.log("");
    console.log("Approval system: ENABLED");
    console.log("GITAM email validation: ENABLED");
    console.log("Admin password: LOADED FROM .env");
    console.log("");
    console.log("=================================");
    console.log("");
});
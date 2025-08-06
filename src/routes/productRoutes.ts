import { Router } from 'express';
import { ProductController } from '../controllers/productController';

const router = Router();
const productController = new ProductController();

// Product CRUD routes
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/categories', productController.getProductCategories);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/sku/:sku', productController.getProductBySku);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

export default router; 
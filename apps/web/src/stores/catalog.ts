import { defineStore } from 'pinia';
import { ref } from 'vue';
import { inventoryApi, itemsApi, suppliersApi, type ProductRow, type SupplierRow } from '@/api';

/**
 * 供应商与库存物品的共享缓存。
 *
 * 这两份数据在台账编辑、发放登记、导入校对、库存页面反复用到，
 * 之前每开一次对话框就重拉一次；这里做进程内缓存 + 在途去重，
 * 写操作后由调用方 invalidate。
 */
export const useCatalogStore = defineStore('catalog', () => {
  const suppliers = ref<SupplierRow[]>([]);
  const products = ref<ProductRow[]>([]);

  let suppliersPromise: Promise<SupplierRow[]> | null = null;
  let productsPromise: Promise<ProductRow[]> | null = null;
  let suppliersLoaded = false;
  let productsLoaded = false;

  async function ensureSuppliers(force = false): Promise<SupplierRow[]> {
    if (force) {
      suppliersLoaded = false;
      suppliersPromise = null;
    }
    if (suppliersLoaded) return suppliers.value;
    if (!suppliersPromise) {
      suppliersPromise = suppliersApi
        .list()
        .then((rows) => {
          suppliers.value = rows;
          suppliersLoaded = true;
          return rows;
        })
        .finally(() => {
          suppliersPromise = null;
        });
    }
    return suppliersPromise;
  }

  async function ensureProducts(force = false): Promise<ProductRow[]> {
    if (force) {
      productsLoaded = false;
      productsPromise = null;
    }
    if (productsLoaded) return products.value;
    if (!productsPromise) {
      productsPromise = inventoryApi
        .products()
        .then((rows) => {
          products.value = rows;
          productsLoaded = true;
          return rows;
        })
        .finally(() => {
          productsPromise = null;
        });
    }
    return productsPromise;
  }

  /** 部门 / 经办人维度：筛选下拉与输入框 datalist 共用 */
  const facets = ref<{ departments: string[]; handlers: string[] }>({ departments: [], handlers: [] });
  let facetsPromise: Promise<unknown> | null = null;
  let facetsLoaded = false;

  async function ensureFacets(force = false): Promise<void> {
    if (force) {
      facetsLoaded = false;
      facetsPromise = null;
    }
    if (facetsLoaded) return;
    if (!facetsPromise) {
      facetsPromise = itemsApi
        .facets()
        .then((f) => {
          facets.value = f;
          facetsLoaded = true;
        })
        .catch(() => undefined)
        .finally(() => {
          facetsPromise = null;
        });
    }
    await facetsPromise;
  }

  function invalidateSuppliers(): void {
    suppliersLoaded = false;
    suppliersPromise = null;
  }

  function invalidateProducts(): void {
    productsLoaded = false;
    productsPromise = null;
  }

  return {
    suppliers,
    products,
    facets,
    ensureSuppliers,
    ensureProducts,
    ensureFacets,
    invalidateSuppliers,
    invalidateProducts,
  };
});

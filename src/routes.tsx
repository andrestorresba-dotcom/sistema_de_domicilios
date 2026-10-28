import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { NewOrder } from "./components/NewOrder";
import { KitchenView } from "./components/KitchenView";
import { DeliveryView } from "./components/DeliveryView";
import { ScanDelivery } from "./components/ScanDelivery";
import { Statistics } from "./components/Statistics";
import { OrdersReport } from "./components/OrdersReport";
import { TableView } from "./components/TableView";
import { Inventory } from "./components/pos/Inventory";
import { PointOfSale } from "./components/pos/PointOfSale";
import { CashClose } from "./components/pos/CashClose";
import { Users } from "./components/pos/Users";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "new-order", Component: NewOrder },
      { path: "kitchen", Component: KitchenView },
      { path: "delivery", Component: DeliveryView },
      { path: "scan", Component: ScanDelivery },
      { path: "statistics", Component: Statistics },
      { path: "reports", Component: OrdersReport },
      { path: "tables", Component: TableView },
      { path: "inventario", Component: Inventory },
      { path: "pos", Component: PointOfSale },
      { path: "cierre-caja", Component: CashClose },
      { path: "usuarios", Component: Users },
    ],
  },
]);
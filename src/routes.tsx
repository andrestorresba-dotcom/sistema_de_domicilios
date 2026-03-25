import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { NewOrder } from "./components/NewOrder";
import { KitchenView } from "./components/KitchenView";
import { DeliveryView } from "./components/DeliveryView";
import { ScanDelivery } from "./components/ScanDelivery";
import { Statistics } from "./components/Statistics";
import { OrdersReport } from "./components/OrdersReport";

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
    ],
  },
]);
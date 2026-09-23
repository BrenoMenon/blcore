import { RouterProvider, createRouter } from "@tanstack/react-router";
// Importa a árvore de rotas gerada automaticamente pelo TanStack Router
import { routeTree } from "./routeTree.gen"; 

// Cria a instância do roteador configurada
const router = createRouter({ routeTree });

export default function App() {
  return <RouterProvider router={router} />;
}

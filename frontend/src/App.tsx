import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Library } from "./pages/Library";
import { Practice } from "./pages/Practice";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/practice/:id" element={<Practice />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

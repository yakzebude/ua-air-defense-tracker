import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Methodology from "./pages/Methodology.tsx";
import Sources from "./pages/Sources.tsx";
import Disclaimer from "./pages/Disclaimer.tsx";
import Changelog from "./pages/Changelog.tsx";
import About from "./pages/About.tsx";
import Imprint from "./pages/Imprint.tsx";
import Contact from "./pages/Contact.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import Alerts from "./pages/Alerts.tsx";
import NewsTicker from "./components/NewsTicker.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NewsTicker />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/about" element={<About />} />
          <Route path="/imprint" element={<Imprint />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/alerts" element={<Alerts />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

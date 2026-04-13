import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import App from "./App";
import ImobApp from "./ImobApp";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clinica" element={<App />} />
        <Route path="/imobiliaria" element={<ImobApp />} />
      </Routes>
    </BrowserRouter>
  );
}

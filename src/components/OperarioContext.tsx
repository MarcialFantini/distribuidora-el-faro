import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Operario } from "../data/seed";
import {
  loadActiveOperarioId,
  loadOperarios,
  replaceAll,
} from "../lib/storage";

interface OperarioContextValue {
  operarios: Operario[];
  active: Operario | null;
  setActiveId: (id: string) => void;
}

const OperarioContext = createContext<OperarioContextValue | null>(null);

export function OperarioProvider({ children }: { children: ReactNode }) {
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOperarios(loadOperarios());
    setActiveId(loadActiveOperarioId());
    setHydrated(true);
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    replaceAll({ activeOperarioId: id });
  }, []);

  const value = useMemo<OperarioContextValue>(
    () => ({
      operarios,
      active: operarios.find((o) => o.id === activeId) ?? null,
      setActiveId: setActive,
    }),
    [operarios, activeId, setActive],
  );

  return (
    <OperarioContext.Provider value={value}>
      <div data-hydrated={hydrated ? "1" : "0"} className="contents">
        {children}
      </div>
    </OperarioContext.Provider>
  );
}

export function useOperario(): OperarioContextValue {
  const ctx = useContext(OperarioContext);
  if (!ctx) {
    return {
      operarios: [],
      active: null,
      setActiveId: () => undefined,
    };
  }
  return ctx;
}

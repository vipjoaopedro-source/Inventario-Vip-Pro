import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Cabecalho({
  titulo,
  subtitulo,
  voltarPara,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {voltarPara ? (
          <Link
            to={voltarPara}
            aria-label="Voltar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl"
          >
            ‹
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl leading-none">{titulo}</h1>
          {subtitulo ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{subtitulo}</p>
          ) : null}
        </div>
        {acao}
      </div>
    </header>
  );
}

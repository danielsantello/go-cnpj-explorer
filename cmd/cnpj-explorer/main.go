package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/danielsantello/go-cnpj-explorer/internal/config"
	"github.com/danielsantello/go-cnpj-explorer/internal/httpapi"
	"github.com/danielsantello/go-cnpj-explorer/internal/webui"
)

func main() {
	cfg, err := config.Load("config.json")
	if err != nil {
		log.Fatalf("não foi possível carregar a configuração: %v", err)
	}

	pages, err := webui.NewHandler()
	if err != nil {
		log.Fatalf("não foi possível carregar a interface: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("GET /", pages)

	mux.HandleFunc("GET /api/health", httpapi.HealthHandler("config.json"))

	mux.HandleFunc("GET /api/companies", httpapi.CompanySearchHandler("config.json"))
	mux.HandleFunc("GET /api/companies/{cnpj}", httpapi.CompanyDetailsHandler("config.json"))
	mux.HandleFunc("GET /api/establishments", httpapi.EstablishmentSearchHandler("config.json"))
	mux.HandleFunc("GET /api/partners", httpapi.PartnerSearchHandler("config.json"))

	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		current, err := config.Load("config.json")
		if err != nil {
			log.Printf("erro ao carregar configuração: %v", err)
			http.Error(w, "Não foi possível carregar a configuração.", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := json.NewEncoder(w).Encode(current); err != nil {
			log.Printf("erro ao responder configuração: %v", err)
		}
	})

	mux.HandleFunc("POST /api/config", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)

		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()

		var updated config.Config

		if err := decoder.Decode(&updated); err != nil {
			http.Error(w, "JSON de configuração inválido.", http.StatusBadRequest)
			return
		}

		if err := decoder.Decode(&struct{}{}); err != io.EOF {
			http.Error(w, "Envie apenas um objeto JSON.", http.StatusBadRequest)
			return
		}

		if err := updated.Validate(); err != nil {
			http.Error(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}

		if err := config.Save("config.json", updated); err != nil {
			log.Printf("erro ao salvar configuração: %v", err)
			http.Error(w, "Não foi possível salvar a configuração.", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})

	server := &http.Server{
		Addr:              "127.0.0.1:8081",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf(
		"configuração carregada: api=%s timeout=%ds",
		cfg.APIURL,
		cfg.TimeoutSeconds,
	)

	log.Printf("servidor disponível em http://%s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

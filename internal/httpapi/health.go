package httpapi

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/danielsantello/go-cnpj-explorer/internal/config"
)

type ServiceHealth struct {
	Status string `json:"status"`
}

type HealthResponse struct {
	Status   string                   `json:"status"`
	Services map[string]ServiceHealth `json:"services"`
}

func HealthHandler(configPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := config.Load(configPath)
		if err != nil {
			log.Printf("erro ao carregar configuração: %v", err)
			http.Error(w, "Não foi possível carregar a configuração.", http.StatusInternalServerError)
			return
		}

		client := &http.Client{
			Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second,
		}

		address := strings.TrimRight(cfg.APIURL, "/") + "/health"

		req, err := http.NewRequestWithContext(
			r.Context(),
			http.MethodGet,
			address,
			nil,
		)
		if err != nil {
			http.Error(w, "Não foi possível preparar a verificação.", http.StatusInternalServerError)
			return
		}

		req.Header.Set("Accept", "application/json")

		response, err := client.Do(req)
		if err != nil {
			log.Printf("erro ao consultar health da API: %v", err)
			http.Error(w, "Não foi possível conectar à API. Confira o endereço e se ela está em execução.", http.StatusBadGateway)
			return
		}
		defer response.Body.Close()

		if response.StatusCode != http.StatusOK &&
			response.StatusCode != http.StatusServiceUnavailable {
			log.Printf("health da API retornou HTTP %d", response.StatusCode)
			http.Error(w, "A API retornou uma resposta inesperada.", http.StatusBadGateway)
			return
		}

		var health HealthResponse

		decoder := json.NewDecoder(io.LimitReader(response.Body, 64*1024))

		if err := decoder.Decode(&health); err != nil {
			http.Error(w, "A API retornou um health inválido.", http.StatusBadGateway)
			return
		}

		if health.Status == "" || health.Services == nil {
			http.Error(w, "A resposta da API não contém as informações de saúde esperadas.", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(response.StatusCode)

		if err := json.NewEncoder(w).Encode(health); err != nil {
			log.Printf("erro ao responder health: %v", err)
		}
	}
}

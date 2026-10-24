package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/danielsantello/go-cnpj-explorer/internal/cnpjapi"
	"github.com/danielsantello/go-cnpj-explorer/internal/config"
)

func CompanyDetailsHandler(configPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := config.Load(configPath)
		if err != nil {
			log.Printf("erro ao carregar configuração: %v", err)
			writeSearchError(w, http.StatusInternalServerError,
				"CONFIG_ERROR", "Não foi possível carregar a configuração.")
			return
		}

		client := cnpjapi.NewClient(
			cfg.APIURL,
			time.Duration(cfg.TimeoutSeconds)*time.Second,
		)

		result, err := client.GetCompany(
			r.Context(),
			r.PathValue("cnpj"),
		)
		if err != nil {
			var apiError *cnpjapi.APIError

			if errors.As(err, &apiError) &&
				apiError.StatusCode >= 400 &&
				apiError.StatusCode <= 599 {
				writeSearchError(w, apiError.StatusCode,
					apiError.Code, apiError.Message)
				return
			}

			log.Printf("erro ao consultar CNPJ: %v", err)
			writeSearchError(w, http.StatusBadGateway,
				"API_ERROR", "Não foi possível consultar o CNPJ na API.")
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := json.NewEncoder(w).Encode(result); err != nil {
			log.Printf("erro ao responder detalhes da empresa: %v", err)
		}
	}
}

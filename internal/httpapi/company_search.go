package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/danielsantello/go-cnpj-explorer/internal/cnpjapi"
	"github.com/danielsantello/go-cnpj-explorer/internal/config"
)

func summarySearchHandler(
	configPath string,
	searchKind string,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()

		page, err := paginationValue(query.Get("page"), 1)
		if err != nil {
			writeSearchError(w, http.StatusBadRequest,
				"INVALID_PAGINATION", "A página deve ser um número inteiro positivo.")
			return
		}

		pageSize, err := paginationValue(query.Get("page_size"), 5)
		if err != nil || pageSize > 100 {
			writeSearchError(w, http.StatusBadRequest,
				"INVALID_PAGINATION", "O tamanho da página deve estar entre 1 e 100.")
			return
		}

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

		search := client.SearchCompanies

		switch searchKind {
		case "trade":
			search = client.SearchEstablishments
		case "partners":
			search = func(ctx context.Context, name string, page, pageSize int) (cnpjapi.CompanySearchResult, error) {
				return client.SearchPartners(ctx, name, page, pageSize, query.Get("document"))
			}
		}

		result, err := search(
			r.Context(),
			query.Get("name"),
			page,
			pageSize,
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

			log.Printf("erro ao buscar empresas: %v", err)
			writeSearchError(w, http.StatusBadGateway,
				"API_ERROR", "Não foi possível consultar as empresas na API.")
			return
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		if err := json.NewEncoder(w).Encode(result); err != nil {
			log.Printf("erro ao responder busca de empresas: %v", err)
		}
	}
}

func paginationValue(value string, defaultValue int) (int, error) {
	if value == "" {
		return defaultValue, nil
	}

	number, err := strconv.Atoi(value)
	if err != nil {
		return 0, err
	}

	if number < 1 {
		return 0, errors.New("valor deve ser positivo")
	}

	return number, nil
}

func writeSearchError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
) {
	payload := struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}{}

	payload.Error.Code = code
	payload.Error.Message = message

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("erro ao responder falha de busca: %v", err)
	}
}

func CompanySearchHandler(configPath string) http.HandlerFunc {
	return summarySearchHandler(configPath, "name")
}

func EstablishmentSearchHandler(configPath string) http.HandlerFunc {
	return summarySearchHandler(configPath, "trade")
}

func PartnerSearchHandler(configPath string) http.HandlerFunc {
	return summarySearchHandler(configPath, "partners")
}

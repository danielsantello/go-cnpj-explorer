package cnpjapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type CodeDescription struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type CompanySummary struct {
	CNPJ               string          `json:"cnpj"`
	CorporateName      string          `json:"corporate_name"`
	TradeName          string          `json:"trade_name,omitempty"`
	Municipality       CodeDescription `json:"municipality"`
	State              string          `json:"state"`
	RegistrationStatus CodeDescription `json:"registration_status"`
	PartnerName        string          `json:"name,omitempty"`
	PartnerDocument    string          `json:"document,omitempty"`
}

type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
}

type CompanySearchResult struct {
	Items      []CompanySummary `json:"items"`
	Pagination Pagination       `json:"pagination"`
}

type APIError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API retornou HTTP %d: %s", e.StatusCode, e.Message)
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string, timeout time.Duration) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *Client) search(
	ctx context.Context,
	endpoint string,
	collection string,
	name string,
	page int,
	pageSize int,
	document ...string,
) (CompanySearchResult, error) {
	query := url.Values{}
	query.Set("name", name)
	query.Set("page", strconv.Itoa(page))
	query.Set("page_size", strconv.Itoa(pageSize))
	if len(document) > 0 && document[0] != "" {
		query.Set("document", document[0])
	}

	address := c.baseURL + endpoint + "?" + query.Encode()

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		address,
		nil,
	)
	if err != nil {
		return CompanySearchResult{}, fmt.Errorf("preparar busca: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(req)
	if err != nil {
		return CompanySearchResult{}, fmt.Errorf("consultar empresas: %w", err)
	}
	defer response.Body.Close()

	decoder := json.NewDecoder(io.LimitReader(response.Body, 1024*1024))

	if response.StatusCode != http.StatusOK {
		var failure struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := decoder.Decode(&failure); err != nil {
			return CompanySearchResult{}, fmt.Errorf(
				"API retornou HTTP %d com uma resposta de erro inválida",
				response.StatusCode,
			)
		}

		return CompanySearchResult{}, &APIError{
			StatusCode: response.StatusCode,
			Code:       failure.Error.Code,
			Message:    failure.Error.Message,
		}
	}

	var payload struct {
		Data map[string]*CompanySearchResult `json:"data"`
	}

	if err := decoder.Decode(&payload); err != nil {
		return CompanySearchResult{}, fmt.Errorf("interpretar busca: %w", err)
	}

	result := payload.Data[collection]
	if result == nil {
		return CompanySearchResult{}, fmt.Errorf(
			"a resposta da API não contém data.%s",
			collection,
		)
	}

	return *result, nil
}

func (c *Client) SearchCompanies(
	ctx context.Context,
	name string,
	page int,
	pageSize int,
) (CompanySearchResult, error) {
	return c.search(
		ctx,
		"/v1/companies",
		"companies",
		name,
		page,
		pageSize,
	)
}

func (c *Client) SearchEstablishments(
	ctx context.Context,
	name string,
	page int,
	pageSize int,
) (CompanySearchResult, error) {
	return c.search(
		ctx,
		"/v1/establishments",
		"establishments",
		name,
		page,
		pageSize,
	)
}

func (c *Client) SearchPartners(
	ctx context.Context,
	name string,
	page int,
	pageSize int,
	document ...string,
) (CompanySearchResult, error) {
	return c.search(
		ctx,
		"/v1/partners",
		"partners",
		name,
		page,
		pageSize,
		document...,
	)
}

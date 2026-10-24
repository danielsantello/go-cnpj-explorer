package cnpjapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func (c *Client) GetCompany(
	ctx context.Context,
	cnpj string,
) (json.RawMessage, error) {
	address := c.baseURL + "/v1/companies/" + url.PathEscape(cnpj)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		address,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("preparar consulta por CNPJ: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("consultar CNPJ: %w", err)
	}
	defer response.Body.Close()

	decoder := json.NewDecoder(
		io.LimitReader(response.Body, 4*1024*1024),
	)

	if response.StatusCode != http.StatusOK {
		var failure struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := decoder.Decode(&failure); err != nil {
			return nil, fmt.Errorf(
				"API retornou HTTP %d com uma resposta de erro inválida",
				response.StatusCode,
			)
		}

		return nil, &APIError{
			StatusCode: response.StatusCode,
			Code:       failure.Error.Code,
			Message:    failure.Error.Message,
		}
	}

	var payload struct {
		Data json.RawMessage `json:"data"`
	}

	if err := decoder.Decode(&payload); err != nil {
		return nil, fmt.Errorf("interpretar detalhes da empresa: %w", err)
	}

	if len(payload.Data) == 0 || string(payload.Data) == "null" {
		return nil, fmt.Errorf("a resposta da API não contém data")
	}

	return payload.Data, nil
}

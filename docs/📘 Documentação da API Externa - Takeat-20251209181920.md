# 📘 Documentação da API Externa - Takeat

API dedicada a consumir dados da Takeat.

**Como os pedidos da Takeat estão organizados:**
1. **table\_sessions** - Sessões de comandas de mesa, comandas únicas, totem e delivery.
2. **individual\_bills** (Contas Individuais) - Cada sessão de mesa (table\_sessions) pode ter múltiplas contas individuais. Dentro da bill pode ter a informação de buyer (se tiver algum cliente associado) ou waiter (se tiver algum garçom associado)
3. **order\_baskets** (Cestas de Pedidos) - Cada conta individual (individual\_bills) pode conter uma ou mais cestas de pedidos.
4. **orders** (Pedidos) - Cada cesta de pedidos (order\_baskets) pode ter múltiplos pedidos.
5. **order\_complement\_categories** (Categorias de Complementos do Pedido) - Cada pedido ([orders](http://orders.id/)) pode ter diferentes categorias de complementos.
6. **order\_complements** (Complementos do Pedido) - Cada categoria de complemento (order\_complement\_categories) pode conter múltiplos complementos.

* * *
### 🔐 Autenticação
**Endpoint:**
`POST` [`https://backend-pdv.takeat.app/public/api/sessions`](https://backend-pdv.takeat.app/public/api/sessions)
**Descrição:**
Realiza a autenticação do restaurante e retorna o token JWT para uso nas demais requisições.

**Body enviado:**

```javascript
{
  "email": "usuario@dominio.com",
  "password": "senha123"
}
```

**Body de resposta:**

```javascript
{
  "restaurant": {
    "id": 1,
    "name": "username", 
    "fantasy_name": "Nome do Restaurante"
  },
  "token": "eyJhbGciOiJIUzI1..."
}
```

**🧾 Observações:**
*   Utilize o token no header `Authorization: Bearer {token}` em todas as chamadas autenticadas.
*   O token possui tempo de expiração de 15 dias.
*   Recomendado criar um usuário único por restaurante para acessar a API externa. Criar via Área do Gestor.
* * *
## 📂 Endpoints Disponíveis
**Base URL:**

```plain
 https://backend-pdv.takeat.app/api/v1
```

* * *
### 🔹 `GET /table-sessions`
**Descrição:**
Retorna as comandas das mesas do restaurante autenticado, dentro do intervalo de datas que é passado.

O que retorna: informações da comanda, a mesa, pagamentos e o método de pagamento, nota fiscal emitida (se houver), as comandas individuais, cestas de compra de cada comanda individual, cada compra que de cada cesta de compra com seu respectivo produto e complementos (se houver).

**Endpoint completo:**
`GET` [`https://backend-pdv.takeat.app/api/v1/table-sessions`](https://backend-pdv.takeat.app/api/v1/table-sessions)

**Headers obrigatórios:**

```javascript
Authorization: Bearer {token}
```

**Query params:**

```javascript
start_date: 2025-08-06T03:00:00
end_date: 2025-08-07T03:00:00
```

**Body de resposta:**

```javascript
[
	{
		"id": 25962545,
		"total_price": "59.00",
		"total_service_price": "64.90",
		"start_time": "2025-08-06T18:22:39.380Z",
		"end_time": "2025-08-06T18:23:10.869Z",
		"completed_at": "2025-08-06T18:23:10.869Z",
		"status": "completed",
		"old_total_price": null,
		"discount_percent": null,
		"discount_total": null,
		"discount_obs": null,
		"has_tax": true,
		"is_delivery": false,
		"with_withdrawal": null,
		"delivery_tax_price": null,
		"total_delivery_price": null,
		"scheduled_to": null,
		"attendance_password": null,
		"delivery_canceled_at": null,
		"merchant_discount": null,
		"delivery_by": null,
		"people_at_table": "1.00",
		"delivery_fee_discount": "0.00",
		"table": {
			"table_number": 1,
			"table_type": "table"
		},
	    "payments": [
			{
				"id": 28038525,
				"payment_value": "50.00",
				"created_at": "2025-08-06T18:22:56.646Z",
				"payment_method": {
					"id": 162,
					"name": "Visa Crédito",
					"keyword": "visa_credito",
					"method": "CREDIT",
					"brand": "VISA"
				},
				"original_value": "50.00",
				"change": "0.00"
			},
			{
				"id": 28038527,
				"payment_value": "14.90",
				"created_at": "2025-08-06T18:23:00.339Z",
				"payment_method": {
					"id": 161,
					"name": "Dinheiro",
					"keyword": "dinheiro",
					"method": "CASH",
					"brand": null
				},
				"original_value": "50.00",
				"change": "35.10"
			}
		],
	    "nfce": {
			"ref": "f5e6aa2a8843",
			"status": "autorizado",
			"type": "nfce",
			"total_price": "64.90",
			"numero": "25416",
			"nfce_html": "https://api.focusnfe.com.br/notas_fiscais_consumidor/NFe32250732005228000160650020000254161003725334.html",
			"nfce_xml": "https://api.focusnfe.com.br/arquivos/32005228000160_31720/202507/XMLs/32250732005228000160650020000254161003725334-nfe.xml",
			"created_at": "2025-06-06T18:26:15.547Z"
		},
		"bills": [
			{
				"id": 31605893,
				"total_price": "59.00",
				"total_service_price": "64.90",
				"start_time": "2025-08-06T18:22:39.445Z",
				"buyer": {
					"phone": "(99) 99999-9999",
					"name": "Matheus",
					"created_by_waiter": null
				},
				"waiter": null,
				"order_baskets": [
					{
						"id": 49064977,
						"order_status": "pending",
						"basket_id": "613-3676",
						"total_price": "59.00",
						"total_service_price": "64.90",
						"start_time": "2025-08-06T18:22:39.563Z",
						"canceled_at": null,
						"channel": "pdv",
						"orders": [
							{
								"id": 74273471,
								"amount": 1,
								"price": "22.00",
								"total_price": "26.00",
								"total_service_price": "28.60",
								"weight": "0.000",
								"canceled_at": null,
								"cancel_reason": null,
								"product": {
									"id": 1793622,
									"name": "X-Tudo"
								},
								"complement_categories": [
									{
										"id": 29544604,
										"complement_category": {
											"id": 562199,
											"name": "Adicionais"
										},
										"order_complements": [
											{
												"id": 40638125,
												"amount": 2,
												"complement": {
													"id": 1530822,
													"name": "Maionese Caseira"
												}
											}
										]
									}
								]
							},
							{
								"id": 74273472,
								"amount": 1,
								"price": "20.00",
								"total_price": "23.00",
								"total_service_price": "25.30",
								"weight": "0.000",
								"canceled_at": null,
								"cancel_reason": null,
								"product": {
									"id": 1793623,
									"name": "X-Bacon"
								},
								"complement_categories": [
									{
										"id": 29544605,
										"complement_category": {
											"id": 562199,
											"name": "Adicionais"
										},
										"order_complements": [
											{
												"id": 40638126,
												"amount": 1,
												"complement": {
													"id": 1530823,
													"name": "Molho Barbecue"
												}
											}
										]
									}
								]
							},
							{
								"id": 74273473,
								"amount": 1,
								"price": "10.00",
								"total_price": "10.00",
								"total_service_price": "11.00",
								"weight": "0.000",
								"canceled_at": null,
								"cancel_reason": null,
								"product": {
									"id": 1793625,
									"name": "Coca-Cola 1,5L"
								},
								"complement_categories": []
							}
						]
					}
				]
			}
		]
	}
]
```

**📌 Observações:**
> **•** O intervalo entre as datas da consulta é de **no máximo 3 dias**.  
>   
> **•** O horário de consulta e retorno é em UTC-0. Para consultar no horário de Brasília, sempre adicionar 3 horas na data que é enviada no query params.  
>   
> **•** Nas orders se tiver o **canceled\_at** diferente de nulo, aquele pedido foi cancelado. E o **cancel\_reason** é o motivo informado no momento do cancelamento.  
>   
> **•** O **total\_price** é o valor total da soma dos produtos, e o **total\_service\_price** é o total\_price + taxa de serviço.  
>   
> **•** O valor do **total\_price** e **total\_service\_price** da table\_session já tem descontado o valor do desconto se houver. E o **old\_total\_price** é o total\_price sem o desconto. Já nas individiual\_bills, order\_baskets e order, o **total\_price** e **total\_service\_price** não tem valor descontado.  
>   
> **•** Nos pagamentos, **é considerado o troco no valor dos pagamentos em dinheiro.**  
> O **payment\_value** é o valor que entrou pro faturamento. O valor já descontado o troco.  
> O **original\_value** é o valor original pago pelo cliente.  
> O **change** é o valor do troco.  
> Ex: o pedido custou R$80, foi pago R$50 em cartão de crédito e R$50 no dinheiro.  
> No cartão de crédito vai ter **payment\_value** igual ao **original\_value,** e o **change** vai ser R$0.  
> No dinheiro vai ter o **payment\_value** como R$30. O **original\_value** vai ser R$50. E o **change** vai ser R$20.  
>   
> **•** O **channel** das order\_baskets é por onde aquele pedido foi feito.

* * *
### 🔹 `GET /payment-methods`
**Descrição:**
Retorna todos os métodos de pagamento ativos cadastrados no sistema.

**Endpoint completo:**
`GET` [`https://backend-pdv.takeat.app/api/v1/payment-methods`](https://backend-pdv.takeat.app/api/v1/payment-methods)

**Headers obrigatórios:**

```plain
Authorization: Bearer {token}
```

**Body enviado:**
_(Não se aplica)_

**Body de resposta:**

```javascript
[
	{
		"id": 27793,
		"name": "Prazo",
		"method": null,
		"brand": null,
		"created_at": "2023-10-18T13:02:37.457Z"
	},
	{
		"id": 174,
		"name": "PicPay",
		"method": null,
		"brand": null,
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 238,
		"name": "Cashback Takeat",
		"method": null,
		"brand": null,
		"created_at": "2021-10-05T20:28:01.051Z"
	},
	{
		"id": 161,
		"name": "Dinheiro",
		"method": "CASH",
		"brand": null,
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 175,
		"name": "Pix",
		"method": "PIX",
		"brand": "PIX",
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 163,
		"name": "Visa Débito",
		"method": "DEBIT",
		"brand": "VISA",
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 164,
		"name": "MasterCard Crédito",
		"method": "CREDIT",
		"brand": "MASTERCARD",
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 166,
		"name": "Elo Crédito",
		"method": "CREDIT",
		"brand": "ELO",
		"created_at": "2021-04-08T12:11:51.400Z"
	},
	{
		"id": 167,
		"name": "Elo Débito",
		"method": "DEBIT",
		"brand": "ELO",
		"created_at": "2021-04-08T12:11:51.400Z"
	}
]
```

**📌 Observações:**
> Alguns métodos não vão ter **method** e/ou **brand**. Principalmente métodos criados pelo próprio restaurante. Mas não tem problema nenhum nisso.

* * *

### 🔹 `GET /products`
**Descrição:**
Retorna as **categorias de produtos** do restaurante, e dentro de cada categoria seus respectivos produtos.

**Endpoint completo:**
`GET` [`https://backend-pdv.takeat.app/api/v1/products`](https://backend-pdv.takeat.app/api/v1/products)

**Headers obrigatórios:**

```javascript
Authorization: Bearer {token}
```

**Body enviado:**
_(Não se aplica)_

**Body de resposta:**

```javascript
[
	{
		"id": 456214,
		"name": "Burgers",
		"available": true,
		"available_in_delivery": false,
		"is_exclusive": false,
		"is_ifood": false,
		"created_at": "2025-03-20T16:46:38.995Z",
		"products": [
			{
				"id": 1439633,
				"name": "X-Tudo",
				"description": "Delicioso X-Tudo completo: pão de hamburger, carne caseira 120g, bacon, queijo, cebola, tomate, alface, milho e banana",
				"price": "24.00",
				"price_promotion": "22.00",
				"available": false,
				"available_in_delivery": true,
				"use_weight": false,
				"delivery_price": "26.00",
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-03-20T16:46:39.121Z"
			},
			{
				"id": 1655566,
				"name": "X-Bacon",
				"description": "Delicioso X-Bacon: pão de hamburger, carne caseira 120g, bacon em dobro e queijo",
				"price": "21.00",
				"price_promotion": null,
				"available": true,
				"available_in_delivery": false,
				"use_weight": true,
				"delivery_price": null,
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-06-26T12:26:57.480Z"
			}
		]
	},
	{
		"id": 456218,
		"name": "Sobremesas",
		"available": false,
		"available_in_delivery": false,
		"is_exclusive": false,
		"is_ifood": false,
		"created_at": "2025-03-20T16:46:42.158Z",
		"products": [
			{
				"id": 1439642,
				"name": "Brownie",
				"description": "Delicioso Brownie Caseiro",
				"price": "6.90",
				"price_promotion": null,
				"available": false,
				"available_in_delivery": false,
				"use_weight": false,
				"delivery_price": "6.90",
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-03-20T16:46:42.296Z"
			},
			{
				"id": 1439643,
				"name": "Palha Italiana",
				"description": "",
				"price": "8.00",
				"price_promotion": null,
				"available": false,
				"available_in_delivery": false,
				"use_weight": false,
				"delivery_price": "8.00",
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-03-20T16:46:42.301Z"
			},
			{
				"id": 1439644,
				"name": "Petit Gateau",
				"description": "Maravilhoso bolo de chocolate com recheio cremoso acompanhado de um sorvete de baunilha.",
				"price": "20.00",
				"price_promotion": null,
				"available": false,
				"available_in_delivery": false,
				"use_weight": false,
				"delivery_price": "20.00",
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-03-20T16:46:42.480Z"
			},
			{
				"id": 1439645,
				"name": "Casquinha \"Desconstruída\"",
				"description": "Saboroso copo de sorvete, recheado nas laterais, com cobertura e complemento a sua escolha.\nLeva o nome de \"Desconsturida\" pois ao invés do tradicional cone de biscoito, o wafer está nas laterais do pote, podendo ser usada como \"colher\".",
				"price": "0.00",
				"price_promotion": null,
				"available": false,
				"available_in_delivery": false,
				"use_weight": false,
				"delivery_price": null,
				"delivery_price_promotion": null,
				"available_multistore": true,
				"ean_codes": null,
				"created_at": "2025-03-20T16:46:42.569Z"
			}
		]
	}
]
```

**📌 Observações:**
> **•** Produtos com **deleted\_at** diferente de null já estão deletados.  
>   
> **•** **is\_exclusive** são categorias e produtos de uso exclusivo do restaurante, que não aparecem pro cliente final.  
>   
> **•** **price** é o preço presencial, **price\_promotion** é o preço promocional do produto presencial (se tiver em promoção). **delivery\_price** é o preço para delivery/retirada, **delivery\_price\_promotion** é o preço promocional do produto delivery/retirada (se tiver em promoção). Se não tiver **delivery\_price** é usado o valor do **price/price\_promotion.**  
>   
> **•** **available** é se o produto/categoria está disponível presencialmente, **available\_in\_delivery** se está disponível no delivery/retirada.  
>   
> **•** **use\_weight** é se o produto for por peso em vez de por unidade

* * *

### 🔹 `GET /complements`
**Descrição:**
Retorna as **categorias de complementos** disponíveis naquele restaurante, com os complementos associados a ela. Um complemento pode estar em mais de uma categoria.

**Endpoint completo:**
`GET` [`https://backend-pdv.takeat.app/api/v1/complements`](https://backend-pdv.takeat.app/api/v1/complements)

**Headers obrigatórios:**

```plain
Authorization: Bearer {token}
```

**Body enviado:**
_(Não se aplica)_

**Body de resposta:**

```javascript
[
	{
		"id": 101186,
		"name": "Adicionais burguer",
		"available": false,
		"available_in_delivery": true,
		"question": "Algum adicional?",
		"limit": 100,
		"minimum": 1,
		"optional": true,
		"additional": false,
		"use_average": false,
		"single_choice": false,
		"more_expensive_only": false,
		"is_ifood": false,
		"enable_times": false,
		"translations": null,
		"is_exclusive": false,
		"complements": [
			{
				"id": 332498,
				"name": "Carne 100g",
				"description": "",
				"price": "0.00",
				"limit": 10,
				"available": true,
				"available_in_delivery": true,
				"delivery_price": null,
				"created_at": "2023-08-30T13:34:43.381Z",
				"active_days": "ttttttt",
				"enable_times": false,
				"translations": null,
				"cccs": {
					"custom_order": 0
				}
			},
			{
				"id": 332500,
				"name": "Ovo",
				"description": "",
				"price": "3.00",
				"limit": 10,
				"available": true,
				"available_in_delivery": true,
				"delivery_price": null,
				"created_at": "2023-08-30T13:34:43.386Z",
				"active_days": "ttttttt",
				"enable_times": false,
				"translations": null,
				"cccs": {
					"custom_order": 1
				}
			},
			{
				"id": 332488,
				"name": "Alface",
				"description": "",
				"price": "1.00",
				"limit": 10,
				"available": true,
				"available_in_delivery": true,
				"delivery_price": null,
				"created_at": "2023-08-30T13:34:43.353Z",
				"active_days": "ttttttt",
				"enable_times": false,
				"translations": null,
				"cccs": {
					"custom_order": 2
				}
			},
			{
				"id": 332502,
				"name": "Tomate",
				"description": "",
				"price": "1.00",
				"limit": 10,
				"available": true,
				"available_in_delivery": true,
				"delivery_price": null,
				"created_at": "2023-08-30T13:34:43.391Z",
				"active_days": "ttttttt",
				"enable_times": false,
				"translations": null,
				"cccs": {
					"custom_order": 3
				}
			}
		]
	},
	{
		"id": 204674,
		"name": "test cafe",
		"available": true,
		"available_in_delivery": true,
		"question": "cafe",
		"limit": 1,
		"minimum": 1,
		"optional": false,
		"additional": true,
		"use_average": false,
		"single_choice": false,
		"more_expensive_only": false,
		"is_ifood": false,
		"enable_times": false,
		"translations": null,
		"is_exclusive": false,
		"complements": [
			{
				"id": 332489,
				"name": "Cookie",
				"description": "Saboso cookie de baunilha com gotas chocolate.",
				"price": "6.90",
				"limit": 10,
				"available": false,
				"available_in_delivery": false,
				"delivery_price": null,
				"created_at": "2023-08-30T13:34:43.355Z",
				"active_days": "ttttttt",
				"enable_times": false,
				"translations": null,
				"cccs": {
					"custom_order": 0
				}
			}
		]
	}
]
```

**📌 Observações:**
> **•** Um complemento pode estar em mais de uma categoria.  
>   
> **• available** é se o complemento/categoria está disponível presencialmente, **available\_in\_delivery** se está disponível no delivery/retirada.  
>   
> **• question** é a pergunta que aparece pro cliente ao exibir a categoria.  
>   
> **• minimum** é a quantidade mínima e **limit** é a quantidade máxima de complementos que podem ser adicionados dentro daquela categoria.  
>   
> **• optional** é se a categoria é opcional. Se for false, é obrigatória.  
>   
> **• additional** é se os valores do complementos são cobrados. Se for false, mesmo os complementos tendo valor, não é cobrado o valor do complemento.  
>   
> **• use\_average** é quando é cobrado a média dos complementos que são selecionados naquela categoria. **more\_expensive\_only** é quando é cobrado apenas o complemento mais caro, mesmo se N complementos forem adicionados.  
>   
> **• is\_exclusive** são categorias e complementos de uso exclusivo do restaurante, que não aparecem pro cliente final.  
>   
> **• limit** nos complementos é a quantidade máxima que pode selecionar daquele complemento.  
>   
> **• price** é o preço presencial, **delivery\_price** é o preço para delivery/retirada. Se não tiver **delivery\_price** é usado o valor do **price.**
###
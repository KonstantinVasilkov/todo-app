import httpx

from tests.factories import AuthedUser


async def _category(client: httpx.AsyncClient, user: AuthedUser, name: str) -> str:
    response = await client.post("/categories", json={"name": name}, headers=user.headers)
    assert response.status_code == 201
    return response.json()["id"]


async def _note_with_categories(
    client: httpx.AsyncClient, user: AuthedUser, category_ids: list[str]
) -> str:
    response = await client.post(
        "/notes", json={"title": "Task", "category_ids": category_ids}, headers=user.headers
    )
    assert response.status_code == 201
    return response.json()["id"]


async def test_deleting_category_unlinks_notes(client: httpx.AsyncClient, user: AuthedUser):
    c1 = await _category(client, user, "work")
    c2 = await _category(client, user, "home")
    note_id = await _note_with_categories(client, user, [c1, c2])

    deleted = await client.delete(f"/categories/{c1}", headers=user.headers)
    assert deleted.status_code == 204

    note = await client.get(f"/notes/{note_id}", headers=user.headers)
    assert note.status_code == 200
    assert [c["id"] for c in note.json()["categories"]] == [c2]

    by_c1 = await client.get("/notes", params={"category_id": c1}, headers=user.headers)
    assert by_c1.status_code == 200
    assert by_c1.json()["total"] == 0

    by_c2 = await client.get("/notes", params={"category_id": c2}, headers=user.headers)
    assert by_c2.status_code == 200
    assert [n["id"] for n in by_c2.json()["items"]] == [note_id]


async def test_deleted_category_cannot_be_assigned(client: httpx.AsyncClient, user: AuthedUser):
    c1 = await _category(client, user, "work")
    assert (await client.delete(f"/categories/{c1}", headers=user.headers)).status_code == 204

    response = await client.post(
        "/notes", json={"title": "Task", "category_ids": [c1]}, headers=user.headers
    )

    assert response.status_code == 422


async def test_user_flow(client: httpx.AsyncClient):
    registered = await client.post(
        "/auth/register",
        json={"username": "carol", "email": "carol@example.com", "password": "password123"},
    )
    assert registered.status_code == 201

    login = await client.post("/auth/login", data={"username": "carol", "password": "password123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    me = await client.get("/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["id"] == registered.json()["id"]

    category = await client.post("/categories", json={"name": "work"}, headers=headers)
    assert category.status_code == 201
    category_id = category.json()["id"]
    note = await client.post(
        "/notes", json={"title": "Ship it", "category_ids": [category_id]}, headers=headers
    )
    assert note.status_code == 201

    listing = await client.get("/notes", headers=headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1
    assert [n["id"] for n in body["items"]] == [note.json()["id"]]
    assert [c["id"] for c in body["items"][0]["categories"]] == [category_id]

import unittest
from app.database.database import SessionLocal, init_db
from app.database.models import FacebookPage
from app.schemas.schemas import FacebookPageCreate, FacebookPageUpdate
from app.services.page_service import page_service
from app.automation.facebook_page import clean_facebook_page_url

class TestPageManagement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_clean_facebook_page_url(self):
        self.assertEqual(
            clean_facebook_page_url("https://www.facebook.com/thammyviensaohan/"),
            "https://www.facebook.com/thammyviensaohan"
        )
        self.assertEqual(
            clean_facebook_page_url("facebook.com/mybrand"),
            "https://www.facebook.com/mybrand"
        )
        self.assertEqual(
            clean_facebook_page_url("/mybrand"),
            "https://www.facebook.com/mybrand"
        )
        self.assertEqual(
            clean_facebook_page_url("https://www.facebook.com/profile.php?id=100083928192&ref=bookmarks"),
            "https://www.facebook.com/profile.php?id=100083928192"
        )

    def test_create_and_update_page(self):
        test_url = "https://www.facebook.com/test_unit_page_123"
        # Cleanup if exists
        existing = self.db.query(FacebookPage).filter(FacebookPage.url == test_url).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()

        page_in = FacebookPageCreate(
            url=test_url,
            name="Test Unit Page",
            category="Trang của tôi",
            selected=True
        )
        created = page_service.create_page(self.db, page_in)
        self.assertIsNotNone(created.id)
        self.assertEqual(created.name, "Test Unit Page")
        self.assertEqual(created.category, "Trang của tôi")
        self.assertTrue(created.selected)

        # Update
        updated = page_service.update_page(self.db, created.id, FacebookPageUpdate(name="Renamed Unit Page", selected=False))
        self.assertEqual(updated.name, "Renamed Unit Page")
        self.assertFalse(updated.selected)

        # Delete
        success = page_service.delete_page(self.db, created.id)
        self.assertTrue(success)

    def test_batch_create_pages(self):
        # Pre-cleanup
        for u in ["https://www.facebook.com/batch_test_p1", "https://www.facebook.com/batch_test_p2"]:
            p = self.db.query(FacebookPage).filter(FacebookPage.url == u).first()
            if p:
                self.db.delete(p)
        self.db.commit()

        urls = [
            "https://www.facebook.com/batch_test_p1",
            "https://www.facebook.com/batch_test_p2",
            "https://google.com/test_not_facebook"
        ]
        res = page_service.batch_create_pages(self.db, urls, category="Trang của tôi")
        self.assertEqual(res["added"], 2)
        self.assertEqual(res["invalid"], 1)

        # Cleanup
        for u in ["https://www.facebook.com/batch_test_p1", "https://www.facebook.com/batch_test_p2"]:
            p = self.db.query(FacebookPage).filter(FacebookPage.url == u).first()
            if p:
                self.db.delete(p)
        self.db.commit()

if __name__ == "__main__":
    unittest.main()

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class HotelProductTemplateCompat(models.Model):
    """Keep the third-party hotel field compatible with the POS catalog.

    The hotel addon marks capacity as required for every product template, but
    existing non-room products legitimately have no room capacity. Keeping the
    override here means vendor updates remain untouched and repeatable.
    """

    _inherit = "product.template"

    def init(self):
        """Normalize legacy templates after the vendor model is loaded."""
        self.env.cr.execute(
            "UPDATE product_template SET num_person = 1 WHERE num_person IS NULL"
        )

    num_person = fields.Integer(
        string="Number Of Persons",
        required=False,
        default=1,
        help="Capacity used when the product is configured as a hotel room.",
        tracking=True,
    )

    @api.constrains("num_person", "is_room")
    def _check_capacity(self):
        for product in self:
            if product.is_room and product.num_person <= 0:
                raise ValidationError(_("Room capacity must be more than 0"))

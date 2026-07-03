const { body } = require('express-validator');

const klookValidators = {
  parse: [
    body('subject').optional().trim(),
    body('text').optional(),
    body('html').optional(),
    body('rawEmail').optional(),
  ],
  import: [
    body('subject').optional().trim(),
    body('text').optional(),
    body('html').optional(),
    body('rawEmail').optional(),
  ],
};

module.exports = klookValidators;
